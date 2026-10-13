import { prisma } from "@/lib/prisma";
import {
  fechaPeru,
  horaPeru,
  formatoHora12,
  obtenerLimitesDiaPeru,
  esFinDeSemanaPeru,
  minutosDesdeMedianoche,
  obtenerVentanaTurno,
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
 * - Turnos activos desde PostgreSQL con ventanas horarias reales.
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

  // REGLA D: Calcular ventanas horarias precisas para cada turno
  const minutosAnticipacion = (estadoMotor as any).minutosAnticipacionEntrada || 60;
  const minutosCierreAuto = (estadoMotor as any).minutosCierreAutomatico || 30;

  type TurnoEvaluado = {
    turno: (typeof turnosActivos)[number];
    ventana: ReturnType<typeof obtenerVentanaTurno>;
    fase: EstadoJornadaDecision;
  };

  const turnosEvaluados: TurnoEvaluado[] = turnosActivos.map((turno) => {
    const ventana = obtenerVentanaTurno({
      horaEntrada: turno.horaEntrada,
      horaSalida: turno.horaSalida,
      margenEntradaAnticipadaMinutos: turno.margenEntradaAnticipadaMinutos || minutosAnticipacion,
      margenSalidaAnticipadaMinutos: turno.margenSalidaAnticipadaMinutos || 0,
      margenSalidaMinutos: turno.margenSalidaMinutos || minutosCierreAuto,
      ahora,
    });

    let fase: EstadoJornadaDecision = "CERRADO";
    if (ahora >= ventana.horaSalidaTurno && ahora <= ventana.finPermitido) {
      fase = "FINALIZANDO";
    } else if (ahora >= ventana.horaEntradaTurno && ahora < ventana.horaSalidaTurno) {
      fase = "OPERATIVO";
    } else if (ahora >= ventana.inicioPermitido && ahora < ventana.horaEntradaTurno) {
      fase = "PREPARANDO";
    }

    return { turno, ventana, fase };
  });

  // Jerarquía operativa institucional entre turnos concurrentes/múltiples:
  // 1. Si algún turno está OPERATIVO -> El colegio está OPERATIVO (clases y marcación activa).
  // 2. Si no hay OPERATIVO pero al menos uno está FINALIZANDO -> FINALIZANDO (salidas de turno en curso).
  // 3. Si no hay OPERATIVO ni FINALIZANDO pero hay PREPARANDO -> PREPARANDO (apertura previa).
  // 4. Si ninguno está activo -> CERRADO.
  const turnoOperativo = turnosEvaluados.find((t) => t.fase === "OPERATIVO");
  const turnoFinalizando = turnosEvaluados.find((t) => t.fase === "FINALIZANDO");
  const turnoPreparando = turnosEvaluados.find((t) => t.fase === "PREPARANDO");

  let estadoCalculado: EstadoJornadaDecision = "CERRADO";
  let motivo = "Fuera del horario de jornada escolar.";
  let turnoCoincidente: (typeof turnosActivos)[number] | null = null;

  if (turnoOperativo) {
    estadoCalculado = "OPERATIVO";
    turnoCoincidente = turnoOperativo.turno;
    motivo = `Turno ${turnoOperativo.turno.nombre} activo y en operación regular.`;
  } else if (turnoFinalizando) {
    estadoCalculado = "FINALIZANDO";
    turnoCoincidente = turnoFinalizando.turno;
    motivo = `Jornada escolar en fase de cierre y salida para el turno ${turnoFinalizando.turno.nombre}.`;
  } else if (turnoPreparando) {
    estadoCalculado = "PREPARANDO";
    turnoCoincidente = turnoPreparando.turno;
    motivo = `Preparando jornada escolar para el turno ${turnoPreparando.turno.nombre} (Apertura anticipada).`;
  } else {
    estadoCalculado = "CERRADO";
    motivo = "Jornada escolar cerrada.";
  }

  // Calcular próxima apertura y próximo cierre
  let proximaAperturaStr: string | undefined;
  let proximoCierreStr: string | undefined;

  const turnosEnCurso = turnosEvaluados.filter((t) => t.fase !== "CERRADO");
  if (turnosEnCurso.length > 0) {
    const finMax = new Date(Math.max(...turnosEnCurso.map((t) => t.ventana.finPermitido.getTime())));
    proximoCierreStr = horaPeru(finMax);
  }

  const aperturasFuturas = turnosEvaluados
    .map((t) => t.ventana.inicioPermitido)
    .filter((d) => d > ahora);

  if (aperturasFuturas.length > 0) {
    const prox = new Date(Math.min(...aperturasFuturas.map((d) => d.getTime())));
    proximaAperturaStr = horaPeru(prox);
  } else {
    const primerTurno = turnosActivos[0];
    if (primerTurno) {
      const minApertura = minutosDesdeMedianoche(primerTurno.horaEntrada) - Math.max(primerTurno.margenEntradaAnticipadaMinutos || minutosAnticipacion, 0);
      proximaAperturaStr = minutosAHoraStr(minApertura);
    }
  }

  if (estadoCalculado === "CERRADO" && proximaAperturaStr) {
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
  // P0-01: El motor debe estar ACTIVO durante PREPARANDO, OPERATIVO y FINALIZANDO
  // permitiendo que las estudiantes registren su salida en la Terminal V2 sin bloqueos.
  const debeEstarActivo =
    estadoCalculado === "OPERATIVO" ||
    estadoCalculado === "PREPARANDO" ||
    estadoCalculado === "FINALIZANDO";
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
