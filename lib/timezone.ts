export const ZONA_HORARIA = "America/Lima";

/**
 * Retorna la fecha canónica en zona horaria de Perú en formato ISO YYYY-MM-DD.
 */
export function fechaPeru(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/**
 * Retorna la hora en formato 24 horas (HH:mm) en zona horaria de Perú.
 */
export function horaPeru(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

/**
 * Retorna la hora formateada en 12 horas con AM/PM en zona horaria de Perú.
 * Ejemplo: "07:35 AM" o "01:20 PM"
 */
export function formatoHora12(fecha: Date = new Date()): string {
  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: ZONA_HORARIA,
  }).toUpperCase();
}

/**
 * Alias para compatibilidad con código existente.
 */
export function formatoHora(fecha: Date = new Date()): string {
  return formatoHora12(fecha);
}

/**
 * Retorna un objeto Date que representa el momento actual en Lima (UTC-5).
 */
export function ahoraPeru(): Date {
  return new Date();
}

/**
 * Crea una fecha Date exacta con offset UTC-5 a partir de fecha (YYYY-MM-DD) y hora (HH:mm).
 */
export function crearFechaHoraPeru(fecha: string, hora: string): Date {
  const horaNormalizada = /^\d{2}:\d{2}$/.test(hora) ? hora : "00:00";
  return new Date(`${fecha}T${horaNormalizada}:00-05:00`);
}

/**
 * Suma o resta días a una fecha (YYYY-MM-DD) y retorna la nueva fecha en formato YYYY-MM-DD.
 */
export function sumarDiasFecha(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T12:00:00-05:00`);
  base.setDate(base.getDate() + dias);
  return fechaPeru(base);
}

/**
 * Obtiene los límites exactos de inicio (00:00:00.000) y fin (23:59:59.999)
 * para un día en hora de Perú (por defecto el día de hoy).
 */
export function obtenerLimitesDiaPeru(fechaStr?: string): {
  inicioDia: Date;
  finDia: Date;
} {
  const hoy = fechaStr || fechaPeru();
  return {
    inicioDia: new Date(`${hoy}T00:00:00.000-05:00`),
    finDia: new Date(`${hoy}T23:59:59.999-05:00`),
  };
}

/**
 * Calcula la ventana operativa completa para un turno asignado.
 * Contempla márgenes de entrada anticipada, horario de salida y turnos que cruzan la medianoche.
 */
export function obtenerVentanaTurno({
  horaEntrada,
  horaSalida,
  margenEntradaAnticipadaMinutos,
  margenSalidaAnticipadaMinutos = 0,
  margenSalidaMinutos,
  ahora = new Date(),
}: {
  horaEntrada: string;
  horaSalida: string;
  margenEntradaAnticipadaMinutos: number;
  margenSalidaAnticipadaMinutos?: number;
  margenSalidaMinutos: number;
  ahora?: Date;
}) {
  const fechaActual = fechaPeru(ahora);
  let fechaBase = fechaActual;

  let horaEntradaTurno = crearFechaHoraPeru(fechaBase, horaEntrada);
  let horaSalidaTurno = crearFechaHoraPeru(fechaBase, horaSalida);

  const cruzaMedianoche = horaSalidaTurno <= horaEntradaTurno;

  if (cruzaMedianoche) {
    horaSalidaTurno = crearFechaHoraPeru(
      sumarDiasFecha(fechaBase, 1),
      horaSalida
    );

    // Si son por ejemplo las 01:00 y el turno es 22:00 -> 02:00, la jornada empezó ayer
    if (ahora < crearFechaHoraPeru(fechaActual, horaSalida)) {
      fechaBase = sumarDiasFecha(fechaActual, -1);
      horaEntradaTurno = crearFechaHoraPeru(fechaBase, horaEntrada);
      horaSalidaTurno = crearFechaHoraPeru(
        sumarDiasFecha(fechaBase, 1),
        horaSalida
      );
    }
  }

  const inicioPermitido = new Date(horaEntradaTurno.getTime());
  inicioPermitido.setMinutes(
    inicioPermitido.getMinutes() - Math.max(margenEntradaAnticipadaMinutos, 0)
  );

  const inicioSalidaPermitido = new Date(horaSalidaTurno.getTime());
  inicioSalidaPermitido.setMinutes(
    inicioSalidaPermitido.getMinutes() - Math.max(margenSalidaAnticipadaMinutos || 0, 0)
  );

  const finPermitido = new Date(horaSalidaTurno.getTime());
  finPermitido.setMinutes(
    finPermitido.getMinutes() + Math.max(margenSalidaMinutos, 0)
  );

  return {
    fechaBase,
    cruzaMedianoche,
    inicioPermitido,
    horaEntradaTurno,
    horaSalidaTurno,
    inicioSalidaPermitido,
    finPermitido,
  };
}

/**
 * Calcula el límite de puntualidad sumando el margen de tolerancia a la hora de entrada.
 */
export function obtenerLimitePuntualidad(
  horaEntradaTurno: Date,
  margenMinutos: number
): Date {
  const limite = new Date(horaEntradaTurno.getTime());
  limite.setMinutes(limite.getMinutes() + Math.max(margenMinutos, 0));
  return limite;
}

/**
 * Determina si la marcación es PUNTUAL o TARDE según la hora y la tolerancia.
 */
export function calcularEstadoAsistencia(
  ahora: Date,
  horaEntradaTurno: Date,
  margenToleranciaMinutos: number
): "PUNTUAL" | "TARDE" {
  const limite = obtenerLimitePuntualidad(
    horaEntradaTurno,
    margenToleranciaMinutos
  );
  return ahora <= limite ? "PUNTUAL" : "TARDE";
}

/**
 * Calcula el estado de salida contemplando la ventana completa:
 * - "PENDIENTE": Si la marcación se intenta antes de inicioVentanaSalida (salida bloqueada)
 * - "SALIDA_ANTICIPADA": Si la marcación ocurre dentro del margen anticipado [horaSalidaTurno - margenSalidaAnticipada, horaSalidaTurno[
 * - "SALIDA_NORMAL": Si la marcación ocurre entre horaSalidaTurno y (horaSalidaTurno + margenSalidaMinutos)
 * - "FUERA_HORARIO": Si la marcación se realiza después de (horaSalidaTurno + margenSalidaMinutos)
 * Detecta si la salida está bloqueada por ocurrir antes de inicioVentanaSalida.
 */
export function calcularEstadoSalida({
  ahora = new Date(),
  horaSalidaTurno,
  margenSalidaAnticipadaMinutos = 0,
  margenSalidaMinutos = 0,
}: {
  ahora?: Date;
  horaSalidaTurno: Date;
  margenSalidaAnticipadaMinutos?: number;
  margenSalidaMinutos: number;
}): {
  estadoSalida: "PENDIENTE" | "SALIDA_ANTICIPADA" | "SALIDA_NORMAL" | "FUERA_HORARIO" | "REGISTRADA";
  esBloqueadoAntesVentana: boolean;
  esAnticipada: boolean;
  esNormal: boolean;
  esFueraHorario: boolean;
  dentroVentanaSalida: boolean;
  inicioVentanaSalida: Date;
  horaSalidaTurno: Date;
  limiteSalida: Date;
} {
  const inicioVentanaSalida = new Date(horaSalidaTurno.getTime());
  inicioVentanaSalida.setMinutes(
    inicioVentanaSalida.getMinutes() - Math.max(margenSalidaAnticipadaMinutos || 0, 0)
  );

  const limiteSalida = new Date(horaSalidaTurno.getTime());
  limiteSalida.setMinutes(
    limiteSalida.getMinutes() + Math.max(margenSalidaMinutos || 0, 0)
  );

  const esBloqueadoAntesVentana = ahora < inicioVentanaSalida;
  const esAnticipada = !esBloqueadoAntesVentana && ahora < horaSalidaTurno;
  const esNormal = ahora >= horaSalidaTurno && ahora <= limiteSalida;
  const esFueraHorario = ahora > limiteSalida;
  const dentroVentanaSalida = !esBloqueadoAntesVentana && !esFueraHorario;

  let estadoSalida: "PENDIENTE" | "SALIDA_ANTICIPADA" | "SALIDA_NORMAL" | "FUERA_HORARIO" = "PENDIENTE";
  if (esBloqueadoAntesVentana) {
    estadoSalida = "PENDIENTE";
  } else if (esAnticipada) {
    estadoSalida = "SALIDA_ANTICIPADA";
  } else if (esNormal) {
    estadoSalida = "SALIDA_NORMAL";
  } else if (esFueraHorario) {
    estadoSalida = "FUERA_HORARIO";
  }

  return {
    estadoSalida,
    esBloqueadoAntesVentana,
    esAnticipada,
    esNormal,
    esFueraHorario,
    dentroVentanaSalida,
    inicioVentanaSalida,
    horaSalidaTurno,
    limiteSalida,
  };
}

/**
 * Evalúa dinámicamente el estado de la jornada para un registro de asistencia:
 * - "CERRADA": Si ya tiene registrada horaSalida.
 * - "ABIERTA": Si tiene horaEntrada y todavía no pasa el fin permitido del turno.
 * - "SIN_SALIDA": Si tiene horaEntrada pero ya concluyó el fin permitido sin registrar salida.
 */
export function evaluarJornadaVigente({
  horaEntrada,
  horaSalida,
  finPermitido,
  ahora = new Date(),
}: {
  horaEntrada?: Date | null;
  horaSalida?: Date | null;
  finPermitido: Date;
  ahora?: Date;
}): "ABIERTA" | "CERRADA" | "SIN_SALIDA" {
  if (horaSalida) {
    return "CERRADA";
  }
  if (horaEntrada) {
    return ahora <= finPermitido ? "ABIERTA" : "SIN_SALIDA";
  }
  return "SIN_SALIDA";
}

/**
 * FASE 7.4: Retorna la hora canónica de Perú (America/Lima) en formato 24h (HH:mm).
 */
export function obtenerHoraPeru(fecha: Date = new Date()): string {
  return horaPeru(fecha);
}

/**
 * Convierte un string "HH:mm" a minutos totales desde la medianoche.
 */
export function minutosDesdeMedianoche(horaStr: string): number {
  const [h, m] = (horaStr || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * FASE 7.4: Valida si una hora determinada está dentro del rango de jornada [horaApertura, horaCierre].
 */
export function estaDentroHorarioJornada(
  horaActual: string,
  horaApertura: string,
  horaCierre: string
): boolean {
  const minutosActual = minutosDesdeMedianoche(horaActual);
  const minutosApertura = minutosDesdeMedianoche(horaApertura);
  const minutosCierre = minutosDesdeMedianoche(horaCierre);

  if (minutosCierre >= minutosApertura) {
    return minutosActual >= minutosApertura && minutosActual <= minutosCierre;
  }
  // Turno o jornada que cruza medianoche
  return minutosActual >= minutosApertura || minutosActual <= minutosCierre;
}

/**
 * FASE 7.4: Determina si una fecha en hora de Perú corresponde a domingo (no lectivo habitual).
 */
export function esFinDeSemanaPeru(fecha: Date = new Date()): boolean {
  const diaSemanaStr = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
  }).format(fecha);
  return diaSemanaStr === "Sun";
}

export * from "./clasificadorAsistencia";

