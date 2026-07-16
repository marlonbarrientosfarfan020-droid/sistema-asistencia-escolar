import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsApp } from "@/services/whatsapp";
import {
  enviarTelegram,
  enviarFotoTelegram,
} from "@/lib/telegram";
import {
  exigirAdminDemoOPersonal,
  exigirAdminOPersonal,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acceso = await exigirAdminDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");

    let inicioDia: Date | undefined;
    let finDia: Date | undefined;

    if (fecha) {
      inicioDia = new Date(`${fecha}T00:00:00-05:00`);
      finDia = new Date(`${fecha}T23:59:59.999-05:00`);
    }

    const asistencias = await prisma.asistencia.findMany({
      where:
        fecha && inicioDia && finDia
          ? {
              fecha: {
                gte: inicioDia,
                lte: finDia,
              },
            }
          : {},
      orderBy: {
        fecha: "desc",
      },
      include: {
        estudiante: {
          include: {
            turno: true,
          },
        },
      },
    });

    return NextResponse.json(asistencias);
  } catch (error) {
    console.error("Error consultando asistencias:", error);

    return NextResponse.json(
      {
        message: "No se pudieron consultar las asistencias",
      },
      { status: 500 }
    );
  }
}

function formatoHora(fecha: Date) {
  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function obtenerLimitesDiaPeru() {
  const hoy = fechaPeru();

  return {
    inicioDia: new Date(`${hoy}T00:00:00-05:00`),
    finDia: new Date(`${hoy}T23:59:59.999-05:00`),
  };
}

async function obtenerEventoNoLectivo(
  turnoId: number | null
) {
  const { inicioDia, finDia } = obtenerLimitesDiaPeru();

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

function horaTurnoPermitida(horaSalida: string) {
  const [hora, minuto] = horaSalida
    .split(":")
    .map(Number);

  const ahora = new Date();

  const fechaPeruActual = ahora.toLocaleDateString(
    "en-CA",
    {
      timeZone: "America/Lima",
    }
  );

  return new Date(
    `${fechaPeruActual}T${String(hora).padStart(
      2,
      "0"
    )}:${String(minuto).padStart(2, "0")}:00-05:00`
  );
}

function horaEntradaPermitida(horaEntrada: string) {
  const [hora, minuto] = horaEntrada
    .split(":")
    .map(Number);

  const fechaActual = fechaPeru();

  return new Date(
    `${fechaActual}T${String(hora).padStart(
      2,
      "0"
    )}:${String(minuto).padStart(2, "0")}:00-05:00`
  );
}

async function descargarFotoComoBuffer(
  fotoUrl: string
): Promise<Buffer | null> {
  try {
    const respuesta = await fetch(fotoUrl, {
      cache: "no-store",
    });

    if (!respuesta.ok) {
      console.error(
        "No se pudo descargar la foto:",
        respuesta.status
      );

      return null;
    }

    const arrayBuffer = await respuesta.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(
      "Error descargando fotografía desde Blob:",
      error
    );

    return null;
  }
}

async function notificarTelegram({
  chatId,
  estudiante,
  tipo,
  hora,
  metodo,
  estado,
  fotoUrl,
}: {
  chatId: string;
  estudiante: any;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
  metodo: string;
  estado: string;
  fotoUrl?: string | null;
}) {
  if (!chatId) return;

  const iconoEstado =
    estado === "TARDE" ? "🟠" : "🟢";

  const mensaje = `🏫 I.E. Santa Rita de Casia

${
  tipo === "ENTRADA"
    ? "✅ ENTRADA REGISTRADA"
    : "👋 SALIDA REGISTRADA"
}

👨‍🎓 Estudiante:
${estudiante.nombres} ${estudiante.apellidos}

📚 Grado:
${estudiante.grado} - ${estudiante.seccion}

⏰ Turno:
${estudiante.turno?.nombre || "Sin turno"} (${
    estudiante.turno?.horaEntrada || "--:--"
  } - ${estudiante.turno?.horaSalida || "--:--"})

${iconoEstado} Estado:
${estado}

🕒 Hora:
${hora}

📌 Método:
${metodo}

📷 Foto capturada al momento de marcar asistencia.`;

  if (fotoUrl) {
    const fotoBuffer =
      await descargarFotoComoBuffer(fotoUrl);

    if (fotoBuffer) {
      await enviarFotoTelegram(
        chatId,
        fotoBuffer,
        mensaje
      );

      return;
    }
  }

  await enviarTelegram(chatId, mensaje);
}

export async function POST(request: Request) {
  const acceso = await exigirAdminOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const dni =
      typeof body.dni === "string"
        ? body.dni.trim()
        : "";

    const codigo =
      typeof body.codigo === "string"
        ? body.codigo.trim()
        : "";

    const metodo =
      typeof body.metodo === "string"
        ? body.metodo.trim()
        : "DNI";

    const fotoUrl =
      typeof body.fotoUrl === "string"
        ? body.fotoUrl.trim()
        : "";

    if (!dni && !codigo) {
      return NextResponse.json(
        {
          message:
            "Debe ingresar el DNI o código del estudiante",
        },
        { status: 400 }
      );
    }

    if (!fotoUrl) {
      return NextResponse.json(
        {
          message: "La fotografía es obligatoria",
        },
        { status: 400 }
      );
    }

    const condicionesBusqueda: Array<
      { dni: string } | { codigo: string }
    > = [];

    if (dni) {
      condicionesBusqueda.push({ dni });
    }

    if (codigo) {
      condicionesBusqueda.push({ codigo });
    }

    const estudiante =
      await prisma.estudiante.findFirst({
        where: {
          OR: condicionesBusqueda,
        },
        include: {
          turno: true,
        },
      });

    if (!estudiante) {
      return NextResponse.json(
        {
          message: "Estudiante no encontrado",
        },
        { status: 404 }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        {
          message: "Estudiante inactivo",
        },
        { status: 400 }
      );
    }

    if (!estudiante.turno) {
      return NextResponse.json(
        {
          message:
            "El estudiante no tiene turno asignado. Asigne un turno antes de registrar asistencia.",
        },
        { status: 400 }
      );
    }

    const eventoNoLectivo =
      await obtenerEventoNoLectivo(
        estudiante.turnoId
      );

    if (eventoNoLectivo) {
      const alcance =
        eventoNoLectivo.todosLosTurnos
          ? "todos los turnos"
          : `el turno ${
              eventoNoLectivo.turno?.nombre ||
              estudiante.turno.nombre
            }`;

      return NextResponse.json(
        {
          message: `Hoy no se registra asistencia porque es un día no lectivo: ${eventoNoLectivo.descripcion}. Aplica para ${alcance}.`,
          diaNoLectivo: true,
          evento: {
            id: eventoNoLectivo.id,
            tipo: eventoNoLectivo.tipo,
            descripcion:
              eventoNoLectivo.descripcion,
            fechaInicio:
              eventoNoLectivo.fechaInicio,
            fechaFin: eventoNoLectivo.fechaFin,
            todosLosTurnos:
              eventoNoLectivo.todosLosTurnos,
            turno:
              eventoNoLectivo.turno?.nombre ||
              null,
          },
        },
        { status: 409 }
      );
    }

    const { inicioDia, finDia } =
      obtenerLimitesDiaPeru();

    let asistencia =
      await prisma.asistencia.findFirst({
        where: {
          estudianteId: estudiante.id,
          fecha: {
            gte: inicioDia,
            lte: finDia,
          },
        },
      });

    const ahora = new Date();
    const horaActual = formatoHora(ahora);

    const horaPermitida =
      horaEntradaPermitida(
        estudiante.turno.horaEntrada
      );

    const estadoAsistencia =
      ahora <= horaPermitida
        ? "PUNTUAL"
        : "TARDE";

    /*
     * REGISTRO DE ENTRADA
     */
    if (!asistencia) {
      asistencia =
        await prisma.asistencia.create({
          data: {
            estudianteId: estudiante.id,
            fecha: ahora,
            horaEntrada: ahora,
            metodo,
            estado: estadoAsistencia,
            fotoUrl,
          },
        });

      try {
        await enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "ENTRADA",
          hora: horaActual,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          turno: `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`,
          estado: estadoAsistencia,
          metodo,
        });
      } catch (error) {
        console.error(
          "Error enviando WhatsApp:",
          error
        );
      }

      try {
        await notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "ENTRADA",
          hora: horaActual,
          metodo,
          estado: estadoAsistencia,
          fotoUrl,
        });
      } catch (error) {
        console.error(
          "Error enviando Telegram:",
          error
        );
      }

      return NextResponse.json({
        tipo: "ENTRADA",
        estudiante,
        asistencia,
        message:
          "Entrada registrada correctamente",
      });
    }

    /*
     * REGISTRO DE SALIDA
     */
    if (!asistencia.horaSalida) {
      const horaSalidaPermitida =
        horaTurnoPermitida(
          estudiante.turno.horaSalida
        );

      if (ahora < horaSalidaPermitida) {
        return NextResponse.json(
          {
            message: `El estudiante ya registró entrada hoy. La salida estará habilitada desde las ${estudiante.turno.horaSalida} del turno ${estudiante.turno.nombre}.`,
          },
          { status: 400 }
        );
      }

      /*
       * Se conserva fotoUrl como fotografía de entrada.
       * La nueva foto de salida se utiliza para Telegram,
       * pero no reemplaza la foto guardada en la base de datos.
       */
      asistencia =
        await prisma.asistencia.update({
          where: {
            id: asistencia.id,
          },
          data: {
            horaSalida: ahora,
          },
        });

      try {
        await enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "SALIDA",
          hora: horaActual,
          grado: estudiante.grado,
          seccion: estudiante.seccion,
          turno: `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`,
          estado: asistencia.estado,
          metodo,
        });
      } catch (error) {
        console.error(
          "Error enviando WhatsApp:",
          error
        );
      }

      try {
        await notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "SALIDA",
          hora: horaActual,
          metodo,
          estado: asistencia.estado,
          fotoUrl,
        });
      } catch (error) {
        console.error(
          "Error enviando Telegram:",
          error
        );
      }

      return NextResponse.json({
        tipo: "SALIDA",
        estudiante,
        asistencia,
        message:
          "Salida registrada correctamente",
      });
    }

    return NextResponse.json(
      {
        message:
          "El estudiante ya registró entrada y salida hoy",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "Error registrando asistencia:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al registrar asistencia",
      },
      { status: 500 }
    );
  }
}