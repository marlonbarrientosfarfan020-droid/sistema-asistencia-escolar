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
  margenSalidaMinutos,
  ahora = new Date(),
}: {
  horaEntrada: string;
  horaSalida: string;
  margenEntradaAnticipadaMinutos: number;
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
