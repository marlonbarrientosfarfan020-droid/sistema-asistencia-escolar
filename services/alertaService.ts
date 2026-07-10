import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/telegram";

function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ahoraPeru() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const y = partes.find((p) => p.type === "year")?.value;
  const m = partes.find((p) => p.type === "month")?.value;
  const d = partes.find((p) => p.type === "day")?.value;
  const h = partes.find((p) => p.type === "hour")?.value;
  const min = partes.find((p) => p.type === "minute")?.value;
  const s = partes.find((p) => p.type === "second")?.value;

  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}-05:00`);
}

function fechaHoraTurno(hora: string) {
  return new Date(`${fechaPeru()}T${hora}:00-05:00`);
}

async function obtenerEventoNoLectivo(
  fechaActual: Date,
  turnoId: number | null
) {
  const inicioDia = new Date(fechaActual);
  inicioDia.setHours(0, 0, 0, 0);

  const finDia = new Date(fechaActual);
  finDia.setHours(23, 59, 59, 999);

  return prisma.calendarioEscolar.findFirst({
    where: {
      estado: true,
      fechaInicio: {
        lte: finDia,
      },
      fechaFin: {
        gte: inicioDia,
      },
      OR: [
        {
          todosLosTurnos: true,
        },
        {
          todosLosTurnos: false,
          turnoId,
        },
      ],
    },
    include: {
      turno: true,
    },
  });
}

export async function revisarAusentes() {
  const hoy = fechaPeru();

  const inicioDia = new Date(`${hoy}T00:00:00-05:00`);
  const finDia = new Date(`${hoy}T23:59:59-05:00`);
  const ahora = ahoraPeru();

  const estudiantes = await prisma.estudiante.findMany({
    where: {
      estado: true,
    },
    include: {
      turno: true,
      asistencias: {
        where: {
          fecha: {
            gte: inicioDia,
            lte: finDia,
          },
        },
      },
    },
  });

  let alertasEnviadas = 0;

  const detalle: {
    estudiante: string;
    estado: string;
  }[] = [];

  for (const estudiante of estudiantes) {
    if (!estudiante.turno) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: "Sin turno asignado",
      });

      continue;
    }

    const eventoNoLectivo = await obtenerEventoNoLectivo(
      ahora,
      estudiante.turnoId
    );

    if (eventoNoLectivo) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: `Día no lectivo: ${eventoNoLectivo.descripcion}`,
      });

      continue;
    }

    if (!estudiante.telegramChatId) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: "Sin Telegram Chat ID",
      });

      continue;
    }

    if (estudiante.asistencias.length > 0) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: "Ya marcó asistencia",
      });

      continue;
    }

    const alertaExistente = await prisma.alertaAsistencia.findUnique({
      where: {
        estudianteId_fecha_tipo: {
          estudianteId: estudiante.id,
          fecha: hoy,
          tipo: "AUSENCIA_ENTRADA",
        },
      },
    });

    if (alertaExistente) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: "Alerta ya enviada hoy",
      });

      continue;
    }

    const horaEntrada = fechaHoraTurno(estudiante.turno.horaEntrada);

    const limite = new Date(horaEntrada);

    limite.setMinutes(
      limite.getMinutes() + estudiante.turno.margenAlertaMinutos
    );

    if (ahora < limite) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: "Dentro del margen",
      });

      continue;
    }

    const mensaje = `🚨 ALERTA DE ASISTENCIA

🏫 I.E. Santa Rita de Casia

Estimado padre/madre de familia, se informa que el estudiante:

👨‍🎓 ${estudiante.nombres} ${estudiante.apellidos}

📚 Grado:
${estudiante.grado} - ${estudiante.seccion}

⏰ Turno:
${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})

⚠️ Aún no registra ingreso al colegio, luego de haber pasado el margen configurado de ${estudiante.turno.margenAlertaMinutos} minutos.

Por favor, comunicarse con la institución o verificar la situación del estudiante.`;

    const enviado = await enviarTelegram(
      estudiante.telegramChatId,
      mensaje
    );

    if (!enviado) {
      detalle.push({
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        estado: "No se pudo enviar Telegram",
      });

      continue;
    }

    await prisma.alertaAsistencia.create({
      data: {
        estudianteId: estudiante.id,
        fecha: hoy,
        tipo: "AUSENCIA_ENTRADA",
      },
    });

    alertasEnviadas++;

    detalle.push({
      estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
      estado: "Alerta enviada",
    });
  }

  return {
    ok: true,
    message: "Revisión de ausentes finalizada",
    alertasEnviadas,
    diaNoLectivo: detalle.some((item) =>
      item.estado.startsWith("Día no lectivo:")
    ),
    detalle,
  };
}