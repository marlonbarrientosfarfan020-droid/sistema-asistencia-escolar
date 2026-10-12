/**
 * services/jornada/cierreJornadaService.ts
 * Servicio Institucional de Cierre Automático de Jornadas Escolares.
 *
 * Responsabilidades:
 * 1. Evalúa el término efectivo de cada turno escolar según su horario y ventana de tolerancia (finPermitido).
 * 2. Cierra registros individuales de estudiantes que registraron entrada pero no marcaron salida:
 *    - Establece `estadoJornada = "SIN_SALIDA"`.
 *    - Mantiene estrictamente `horaSalida = null` y `fotoSalida = null` (no inventa marcaciones).
 * 3. Cierra registros completos que aún estuvieran como "ABIERTA" -> "CERRADA".
 * 4. Operación estrictamente idempotente, filtrada por colegio, turno y fecha de jornada (fechaBase).
 * 5. Corrige la atribución de fecha en turnos nocturnos que cruzan la medianoche.
 * 6. Actualiza el SuperMotor institucional si todos los turnos del día han finalizado.
 * 7. Emite eventos en tiempo real para sincronización inmediata de monitores y Portal de Padres.
 */

import { prisma } from "@/lib/prisma";
import {
  obtenerVentanaTurno,
  fechaPeru,
  horaPeru,
} from "@/lib/timezone";
import { emitEvent } from "@/lib/events/eventBus";
import { obtenerEstadoSuperMotor, actualizarEstadoSuperMotor } from "@/lib/supermotor";

export interface OpcionesCierreJornada {
  colegioId?: string;
  ahora?: Date;
  fechaDiaFiltro?: string;
  turnoIdFiltro?: number;
  forzarCierre?: boolean;
}

export interface DetalleCierreTurno {
  turnoId: number;
  turnoNombre: string;
  fechaDia: string;
  horaSalida: string;
  finPermitido: string;
  turnoVencido: boolean;
  registrosSinSalida: number;
  registrosCompletosCerrados: number;
}

export interface ResultadoCierreJornada {
  ok: boolean;
  colegioId: string;
  timestamp: string;
  turnosEvaluados: number;
  turnosVencidos: number;
  totalSinSalidaCerrados: number;
  totalCompletosCerrados: number;
  detalles: DetalleCierreTurno[];
  supermotorCerrado?: boolean;
}

/**
 * Ejecuta el barrido y cierre de jornadas escolares vencidas.
 * Puede ser invocado por cron jobs de Vercel, endpoints dedicados o de manera oportunista
 * en eventos de sincronización sin depender de que un admin abra el dashboard.
 */
export async function ejecutarCierreJornadasVencidas(
  opciones?: OpcionesCierreJornada
): Promise<ResultadoCierreJornada> {
  const colegioId = opciones?.colegioId || "SANTA_RITA_001";
  const ahora = opciones?.ahora || new Date();
  const forzar = Boolean(opciones?.forzarCierre);

  // 1. Obtener turnos activos de la institución
  const turnos = await prisma.turno.findMany({
    where: {
      colegioId,
      estado: true,
      ...(opciones?.turnoIdFiltro ? { id: opciones.turnoIdFiltro } : {}),
    },
    orderBy: { horaEntrada: "asc" },
  });

  const detalles: DetalleCierreTurno[] = [];
  let totalSinSalidaCerrados = 0;
  let totalCompletosCerrados = 0;
  let turnosVencidosCount = 0;
  let todosTurnosConcluidos = true;

  for (const turno of turnos) {
    const ventana = obtenerVentanaTurno({
      horaEntrada: turno.horaEntrada,
      horaSalida: turno.horaSalida,
      margenEntradaAnticipadaMinutos: turno.margenEntradaAnticipadaMinutos,
      margenSalidaAnticipadaMinutos: turno.margenSalidaAnticipadaMinutos ?? 0,
      margenSalidaMinutos: turno.margenSalidaMinutos,
      ahora,
    });

    const fechaDia = opciones?.fechaDiaFiltro || ventana.fechaBase;
    const esVencido = forzar || ahora > ventana.finPermitido;

    if (!esVencido) {
      todosTurnosConcluidos = false;
      detalles.push({
        turnoId: turno.id,
        turnoNombre: turno.nombre,
        fechaDia,
        horaSalida: turno.horaSalida,
        finPermitido: ventana.finPermitido.toISOString(),
        turnoVencido: false,
        registrosSinSalida: 0,
        registrosCompletosCerrados: 0,
      });
      continue;
    }

    turnosVencidosCount++;

    // 2. Localizar asistencias abiertas que ingresaron pero NO marcaron salida
    const sinSalidaPendientes = await prisma.asistencia.findMany({
      where: {
        colegioId,
        turnoId: turno.id,
        fechaDia,
        horaEntrada: { not: null },
        horaSalida: null,
        estadoJornada: { notIn: ["SIN_SALIDA", "CERRADA"] },
      },
      select: {
        id: true,
        estudianteId: true,
        estado: true,
      },
    });

    let sinSalidaCount = 0;
    for (const asist of sinSalidaPendientes) {
      await prisma.asistencia.update({
        where: { id: asist.id },
        data: {
          estadoJornada: "SIN_SALIDA",
          // Estricto: horaSalida permanece null, fotoSalida permanece null
        },
      });

      sinSalidaCount++;

      // Notificar en bus de eventos para actualización reactiva en vivo
      try {
        emitEvent("ASISTENCIA_REGISTRADA", {
          asistenciaId: asist.id,
          estudianteId: asist.estudianteId,
          estadoJornada: "SIN_SALIDA",
          colegioId,
        });
      } catch (errEvent) {
        console.warn("[CIERRE JORNADA] Error emitiendo evento reactivo:", errEvent);
      }
    }

    // 3. Normalizar asistencias que tienen salida marcada pero quedaron en estadoJornada "ABIERTA"
    const completosPendientes = await prisma.asistencia.updateMany({
      where: {
        colegioId,
        turnoId: turno.id,
        fechaDia,
        horaEntrada: { not: null },
        horaSalida: { not: null },
        estadoJornada: "ABIERTA",
      },
      data: {
        estadoJornada: "CERRADA",
      },
    });

    totalSinSalidaCerrados += sinSalidaCount;
    totalCompletosCerrados += completosPendientes.count;

    detalles.push({
      turnoId: turno.id,
      turnoNombre: turno.nombre,
      fechaDia,
      horaSalida: turno.horaSalida,
      finPermitido: ventana.finPermitido.toISOString(),
      turnoVencido: true,
      registrosSinSalida: sinSalidaCount,
      registrosCompletosCerrados: completosPendientes.count,
    });
  }

  // 4. Actualizar estado del SuperMotor si todos los turnos del día están concluidos
  // Respetar estrictamente el modo MANUAL: no apagar el motorActivo del director en modo manual
  let supermotorCerrado = false;
  if (todosTurnosConcluidos && turnos.length > 0) {
    try {
      const estadoMotor = await obtenerEstadoSuperMotor(colegioId);
      const esModoAutomatico = (estadoMotor as any).modoOperacion === "AUTOMATICO";

      if (esModoAutomatico && estadoMotor.estadoJornada !== "CERRADO") {
        await actualizarEstadoSuperMotor({
          colegioId,
          motorActivo: false,
          estadoJornada: "CERRADO",
          usuario: "CIERRE_AUTOMATICO_JORNADA",
          rol: "SISTEMA",
          motivo: "Todos los turnos escolares del día han concluido su ventana permitida.",
        });
        supermotorCerrado = true;
      }
    } catch (errMotor) {
      console.warn("[CIERRE JORNADA] Error actualizando SuperMotor:", errMotor);
    }
  }

  return {
    ok: true,
    colegioId,
    timestamp: ahora.toISOString(),
    turnosEvaluados: turnos.length,
    turnosVencidos: turnosVencidosCount,
    totalSinSalidaCerrados,
    totalCompletosCerrados,
    detalles,
    supermotorCerrado,
  };
}
