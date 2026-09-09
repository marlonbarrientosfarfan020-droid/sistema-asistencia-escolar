import { prisma } from "@/lib/prisma";
import {
  fechaPeru,
  horaPeru,
  formatoHora12,
  obtenerLimitesDiaPeru,
  esFinDeSemanaPeru,
  minutosDesdeMedianoche,
} from "@/lib/timezone";
import {
  obtenerEstadoSuperMotor,
  actualizarEstadoSuperMotor,
} from "@/lib/supermotor";
import { emitEvent, COLEGIO_DEFAULT_ID } from "@/lib/events/eventBus";

export type EstadoJornadaDecision =
  | "CERRADO"
  | "PREPARANDO"
  | "OPERATIVO"
  | "FINALIZANDO";

export interface ResultadoEvaluacionJornada {
  modo: "MANUAL" | "AUTOMATICO";
  estado: EstadoJornadaDecision;
  motivo: string;
  horaPeru: string;
  fechaPeru: string;
  turno?: string;
  proximaApertura?: string;
  proximoCierre?: string;
  motorActivo: boolean;
  cambioRealizado?: boolean;
}

/**
 * Formatea minutos desde medianoche a string HH:mm y formato 12h.
 */
function minutosAHoraStr(minutosTotales: number): string {
  const norm = ((minutosTotales % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const hStr = h.toString().padStart(2, "0");
  const mStr = m.toString().padStart(2, "0");
  return `${hStr}:${mStr}`;
}

/**
 * FASE 7.5: Motor de Decisión de Jornada Escolar Inteligente.
 * Evalúa automáticamente la operación escolar utilizando:
 * - Calendario Escolar (feriados, suspensiones, días no lectivos).
 * - Turnos activos.
 * - Hora de Perú (America/Lima).
 * - Configuración institucional del SuperMotor.
 */
export async function evaluarJornadaActual(opciones?: {
  forzarModo?: "MANUAL" | "AUTOMATICO";
  colegioId?: string;
  fechaReferencia?: Date;
}): Promise<ResultadoEvaluacionJornada> {
  const colegioId = opciones?.colegioId && opciones.colegioId !== "default" ? opciones.colegioId : "SANTA_RITA_001";
  const ahora = opciones?.fechaReferencia || new Date();
  const horaActualStr = horaPeru(ahora);
  const fechaActualStr = fechaPeru(ahora);
  const minutosActuales = minutosDesdeMedianoche(horaActualStr);

  // 1. Consultar estado del SuperMotor
  const estadoMotor = await obtenerEstadoSuperMotor(colegioId);
  const modo = opciones?.forzarModo || (estadoMotor as any).modoOperacion || "MANUAL";

  // CASO 1: MODO MANUAL (El Director controla soberanamente el SuperMotor)
  if (modo === "MANUAL") {
    const estadoJornadaManual = (estadoMotor.estadoJornada as EstadoJornadaDecision) || "CERRADO";
    return {
      modo: "MANUAL",
      estado: estadoMotor.motorActivo ? estadoJornadaManual : "CERRADO",
      motivo: `Modo Manual activo: SuperMotor ${estadoMotor.motorActivo ? "ENCENDIDO" : "APAGADO"} por la dirección.`,
      horaPeru: horaActualStr,
      fechaPeru: fechaActualStr,
      motorActivo: estadoMotor.motorActivo,
      cambioRealizado: false,
    };
  }

  // CASO 2: MODO AUTOMÁTICO (El sistema decide según reglas configuradas)

  // REGLA A: Días de fin de semana (Domingo habitual no lectivo)
  if (esFinDeSemanaPeru(ahora)) {
    return procesarResultadoAutomatico({
      estadoCalculado: "CERRADO",
      motivo: "Fin de semana (Domingo no lectivo): Jornada escolar cerrada.",
      horaActualStr,
      fechaActualStr,
      estadoMotor,
      colegioId,
    });
  }

  // REGLA B: Consultar Calendario Escolar para eventos no lectivos de este colegio
  const { inicioDia, finDia } = obtenerLimitesDiaPeru(fechaActualStr);
  const eventoNoLectivo = await prisma.calendarioEscolar.findFirst({
    where: {
      colegioId,
      estado: true,
      fechaInicio: { lte: finDia },
      fechaFin: { gte: inicioDia },
    },
  });

  if (eventoNoLectivo) {
    return procesarResultadoAutomatico({
      estadoCalculado: "CERRADO",
      motivo: `Día no lectivo programado en calendario escolar: ${eventoNoLectivo.descripcion || eventoNoLectivo.tipo}.`,
      horaActualStr,
      fechaActualStr,
      estadoMotor,
      colegioId,
    });
  }

  // REGLA C: Consultar Turnos Escolares Activos de este colegio
  const turnosActivos = await prisma.turno.findMany({
    where: { colegioId, estado: true },
    orderBy: { horaEntrada: "asc" },
  });

  if (turnosActivos.length === 0) {
    return procesarResultadoAutomatico({
      estadoCalculado: "CERRADO",
      motivo: "No existen turnos escolares activos en la institución.",
      horaActualStr,
      fechaActualStr,
      estadoMotor,
      colegioId,
    });
  }

  // REGLA D: Calcular ventanas horarias de turnos
  // Anticipación por defecto: 60 minutos antes de la primera entrada
  const minutosAnticipacion = (estadoMotor as any).minutosAnticipacionEntrada || 60;
  // Cierre por defecto: 30 minutos después de la última salida
  const minutosCierreAuto = (estadoMotor as any).minutosCierreAutomatico || 30;

  let globalMinApertura = Infinity;
  let globalMinEntrada = Infinity;
  let globalMaxSalida = -Infinity;
  let globalMaxCierre = -Infinity;
  let turnoCoincidente: any = null;

  for (const turno of turnosActivos) {
    const minEntrada = minutosDesdeMedianoche(turno.horaEntrada);
    const minSalida = minutosDesdeMedianoche(turno.horaSalida);
    const minApertura = minEntrada - Math.max(turno.margenEntradaAnticipadaMinutos || minutosAnticipacion, 0);
    const minCierre = minSalida + Math.max(turno.margenSalidaMinutos || minutosCierreAuto, 0);

    if (minApertura < globalMinApertura) globalMinApertura = minApertura;
    if (minEntrada < globalMinEntrada) globalMinEntrada = minEntrada;
    if (minSalida > globalMaxSalida) globalMaxSalida = minSalida;
    if (minCierre > globalMaxCierre) globalMaxCierre = minCierre;

    // Verificar si el momento actual pertenece a este turno específico
    if (minutosActuales >= minApertura && minutosActuales <= minCierre) {
      turnoCoincidente = turno;
    }
  }

  const proximaAperturaStr = minutosAHoraStr(globalMinApertura);
  const proximoCierreStr = minutosAHoraStr(globalMaxCierre);

  let estadoCalculado: EstadoJornadaDecision = "CERRADO";
  let motivo = "Fuera del horario de jornada escolar.";

  if (minutosActuales >= globalMinApertura && minutosActuales < globalMinEntrada) {
    estadoCalculado = "PREPARANDO";
    motivo = `Preparando jornada escolar para el turno ${turnoCoincidente?.nombre || "activo"} (Apertura anticipada).`;
  } else if (minutosActuales >= globalMinEntrada && minutosActuales <= globalMaxSalida) {
    estadoCalculado = "OPERATIVO";
    motivo = `Turno ${turnoCoincidente?.nombre || "escolar"} activo y en operación regular.`;
  } else if (minutosActuales > globalMaxSalida && minutosActuales <= globalMaxCierre) {
    estadoCalculado = "FINALIZANDO";
    motivo = `Jornada escolar en fase de cierre y salida para el turno ${turnoCoincidente?.nombre || "activo"}.`;
  } else {
    estadoCalculado = "CERRADO";
    motivo = `Jornada escolar cerrada. Próxima apertura programada a las ${proximaAperturaStr}.`;
  }

  return procesarResultadoAutomatico({
    estadoCalculado,
    motivo,
    horaActualStr,
    fechaActualStr,
    turnoNombre: turnoCoincidente?.nombre,
    proximaApertura: proximaAperturaStr,
    proximoCierre: proximoCierreStr,
    estadoMotor,
    colegioId,
  });
}

/**
 * Aplica la decisión automática en el SuperMotor y emite eventos en tiempo real si hubo transición.
 */
async function procesarResultadoAutomatico({
  estadoCalculado,
  motivo,
  horaActualStr,
  fechaActualStr,
  turnoNombre,
  proximaApertura,
  proximoCierre,
  estadoMotor,
  colegioId,
}: {
  estadoCalculado: EstadoJornadaDecision;
  motivo: string;
  horaActualStr: string;
  fechaActualStr: string;
  turnoNombre?: string;
  proximaApertura?: string;
  proximoCierre?: string;
  estadoMotor: any;
  colegioId: string;
}): Promise<ResultadoEvaluacionJornada> {
  const debeEstarActivo = estadoCalculado === "OPERATIVO" || estadoCalculado === "PREPARANDO";
  let cambioRealizado = false;

  // Evaluar si hubo cambio de estado en el SuperMotor
  if (estadoMotor.motorActivo !== debeEstarActivo || estadoMotor.estadoJornada !== estadoCalculado) {
    console.log(
      `[MOTOR_JORNADA] Transición automática: ${estadoMotor.motorActivo ? "ON" : "OFF"} (${
        estadoMotor.estadoJornada
      }) -> ${debeEstarActivo ? "ON" : "OFF"} (${estadoCalculado})`
    );

    await actualizarEstadoSuperMotor({
      motorActivo: debeEstarActivo,
      estadoJornada: estadoCalculado,
      usuario: "MOTOR_JORNADA_AUTO",
      rol: "SISTEMA",
      motivo: `Activación/Cierre automático: ${motivo}`,
      colegioId,
    });

    cambioRealizado = true;

    // FASE 7.8: Emitir eventos en tiempo real JORNADA_INICIADA o JORNADA_CERRADA
    if (debeEstarActivo && !estadoMotor.motorActivo) {
      emitEvent(
        "JORNADA_INICIADA",
        {
          estado: estadoCalculado,
          motivo,
          hora: horaActualStr,
          fecha: fechaActualStr,
          turno: turnoNombre,
        },
        colegioId
      );
    } else if (!debeEstarActivo && estadoMotor.motorActivo) {
      emitEvent(
        "JORNADA_CERRADA",
        {
          estado: "CERRADO",
          motivo,
          hora: horaActualStr,
          fecha: fechaActualStr,
        },
        colegioId
      );
    }
  }

  return {
    modo: "AUTOMATICO",
    estado: estadoCalculado,
    motivo,
    horaPeru: horaActualStr,
    fechaPeru: fechaActualStr,
    turno: turnoNombre,
    proximaApertura,
    proximoCierre,
    motorActivo: debeEstarActivo,
    cambioRealizado,
  };
}
