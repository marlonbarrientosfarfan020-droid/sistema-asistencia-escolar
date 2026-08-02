const ZONA_HORARIA = "America/Lima";

export function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ahoraPeru() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const obtener = (
    tipo: Intl.DateTimeFormatPartTypes
  ) =>
    partes.find((parte) => parte.type === tipo)
      ?.value || "00";

  return new Date(
    `${obtener("year")}-${obtener("month")}-${obtener(
      "day"
    )}T${obtener("hour")}:${obtener(
      "minute"
    )}:${obtener("second")}-05:00`
  );
}

export function fechaHoraTurno(hora: string) {
  const horaNormalizada =
    /^\d{2}:\d{2}$/.test(hora)
      ? hora
      : "00:00";

  return new Date(
    `${fechaPeru()}T${horaNormalizada}:00-05:00`
  );
}

export function sumarMinutos(
  fecha: Date,
  minutos: number
) {
  const resultado = new Date(fecha);

  resultado.setMinutes(
    resultado.getMinutes() +
      Math.max(minutos, 0)
  );

  return resultado;
}

export function limitesDiaPeru() {
  const hoy = fechaPeru();

  return {
    inicioDia: new Date(
      `${hoy}T00:00:00.000-05:00`
    ),

    finDia: new Date(
      `${hoy}T23:59:59.999-05:00`
    ),
  };
}

export function fechaCalendarioBD() {
  return new Date(
    `${fechaPeru()}T00:00:00.000Z`
  );
}