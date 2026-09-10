import { crearFechaHoraPeru, fechaPeru, ahoraPeru } from "./timezone";

export type EstadoOperativoEstudiante =
  | "PUNTUAL"
  | "TARDE"
  | "JUSTIFICADO"
  | "PENDIENTE_INICIO"
  | "ESPERANDO_INGRESO"
  | "INGRESO_PENDIENTE"
  | "TARDANZA_SIN_INGRESO"
  | "AUSENTE_CONFIRMADO"
  | "TURNO_INACTIVO"
  | "NO_LECTIVO"
  | "SIN_TURNO";

export interface DatosTurnoParaClasificacion {
  id?: number;
  nombre?: string;
  horaEntrada: string;
  horaSalida: string;
  minutosAlertaInicial?: number | null;
  margenAlertaMinutos?: number | null;
  estado: boolean;
}

export interface DatosAsistenciaParaClasificacion {
  horaEntrada?: Date | string | null;
  estado?: string | null;
}

export interface OpcionesClasificacionEstudiante {
  ahora?: Date;
  fechaConsulta?: string; // Formato YYYY-MM-DD
  turno?: DatosTurnoParaClasificacion | null;
  asistencia?: DatosAsistenciaParaClasificacion | null;
  esDiaNoLectivo?: boolean;
}

function sumarMinutos(base: Date, minutos: number): Date {
  const r = new Date(base.getTime());
  r.setMinutes(r.getMinutes() + Math.max(Number(minutos) || 0, 0));
  return r;
}

/**
 * Motor compartido y unificado de clasificación del estado de un estudiante.
 * Garantiza consistencia estricta entre:
 * 1. Portal Público (/api/publica/asistencia)
 * 2. Dashboard Administrativo (/api/dashboard)
 * 3. Automatizaciones y Cron (/services/automatizaciones/procesarAlertas)
 */
export function clasificarEstadoEstudiante(
  opciones: OpcionesClasificacionEstudiante
): EstadoOperativoEstudiante {
  const turno = opciones.turno;

  // 1. Sin turno asignado
  if (!turno) {
    return "SIN_TURNO";
  }

  // 2. REGLA INSTITUCIONAL: Turno inactivo (estado = false)
  // Sus estudiantes NO son ausentes, ni tardanzas, ni pendientes operativos
  if (!turno.estado) {
    return "TURNO_INACTIVO";
  }

  // 3. Día no lectivo (feriado / suspensión de clases)
  if (opciones.esDiaNoLectivo) {
    return "NO_LECTIVO";
  }

  // 4. Si el estudiante ya cuenta con marcación registrada hoy
  if (opciones.asistencia?.horaEntrada) {
    const estadoMarcado = (opciones.asistencia.estado || "").toUpperCase();
    if (estadoMarcado === "JUSTIFICADO") {
      return "JUSTIFICADO";
    }
    if (estadoMarcado === "TARDE" || estadoMarcado === "TARDANZA") {
      return "TARDE";
    }
    return "PUNTUAL";
  }

  // 5. Sin marcación registrada: evaluación cronológica de la ventana del turno
  const ahora = opciones.ahora || ahoraPeru();
  const fechaBase = opciones.fechaConsulta || fechaPeru(ahora);

  const horaEntrada = crearFechaHoraPeru(fechaBase, turno.horaEntrada);
  const minutosAviso = Math.max(Number(turno.minutosAlertaInicial) || 5, 0);
  const margenTardanza = Math.max(Number(turno.margenAlertaMinutos) || 15, 0);

  const limiteAviso = sumarMinutos(horaEntrada, minutosAviso);
  const limiteTardanza = sumarMinutos(horaEntrada, margenTardanza);
  const horaSalida = crearFechaHoraPeru(fechaBase, turno.horaSalida);

  // A. Antes de la hora de entrada: turno aún no inicia
  if (ahora < horaEntrada) {
    return "PENDIENTE_INICIO";
  }

  // B. Ventana de tolerancia inicial (esperando llegada)
  if (ahora < limiteAviso) {
    return "ESPERANDO_INGRESO";
  }

  // C. Ventana de ingreso pendiente
  if (ahora < limiteTardanza) {
    return "INGRESO_PENDIENTE";
  }

  // D. Pasó el margen de tardanza pero aún no concluye la jornada escolar
  if (ahora < horaSalida) {
    return "TARDANZA_SIN_INGRESO";
  }

  // E. Concluyó la jornada escolar del turno sin registrar ingreso: AUSENCIA CONFIRMADA
  return "AUSENTE_CONFIRMADO";
}

export function esEstadoPresente(estado: EstadoOperativoEstudiante): boolean {
  return estado === "PUNTUAL" || estado === "TARDE" || estado === "JUSTIFICADO";
}

export function esEstadoPendienteOperativo(estado: EstadoOperativoEstudiante): boolean {
  return (
    estado === "PENDIENTE_INICIO" ||
    estado === "ESPERANDO_INGRESO" ||
    estado === "INGRESO_PENDIENTE" ||
    estado === "TARDANZA_SIN_INGRESO"
  );
}

export function esEstadoAusenteConfirmado(estado: EstadoOperativoEstudiante): boolean {
  return estado === "AUSENTE_CONFIRMADO";
}

export function esEstadoTurnoInactivo(estado: EstadoOperativoEstudiante): boolean {
  return estado === "TURNO_INACTIVO";
}
