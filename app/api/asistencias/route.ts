import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { enviarWhatsApp } from "@/services/whatsapp";
import { enviarTelegram } from "@/lib/telegram";
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
function crearFechaHoraPeru(
  fecha: string,
  hora: string
) {
  const horaNormalizada =
    /^\d{2}:\d{2}$/.test(hora)
      ? hora
      : "00:00";

  return new Date(
    `${fecha}T${horaNormalizada}:00-05:00`
  );
}

function sumarDiasFecha(
  fecha: string,
  dias: number
) {
  const base = new Date(
    `${fecha}T12:00:00-05:00`
  );

  base.setDate(
    base.getDate() + dias
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(base);
}

function obtenerVentanaTurno({
  horaEntrada,
  horaSalida,
  margenEntradaAnticipadaMinutos,
  margenSalidaMinutos,
  ahora,
}: {
  horaEntrada: string;
  horaSalida: string;
  margenEntradaAnticipadaMinutos: number;
  margenSalidaMinutos: number;
  ahora: Date;
}) {
  const fechaActual = fechaPeru();

  let fechaBase =
    fechaActual;

  let horaEntradaTurno =
    crearFechaHoraPeru(
      fechaBase,
      horaEntrada
    );

  let horaSalidaTurno =
    crearFechaHoraPeru(
      fechaBase,
      horaSalida
    );

  const cruzaMedianoche =
    horaSalidaTurno <=
    horaEntradaTurno;

  if (cruzaMedianoche) {
    horaSalidaTurno =
      crearFechaHoraPeru(
        sumarDiasFecha(
          fechaBase,
          1
        ),
        horaSalida
      );

    /*
     * Si son, por ejemplo, las 01:00
     * y el turno es 22:00 → 02:00,
     * la jornada empezó el día anterior.
     */
    if (
      ahora <
      crearFechaHoraPeru(
        fechaActual,
        horaSalida
      )
    ) {
      fechaBase =
        sumarDiasFecha(
          fechaActual,
          -1
        );

      horaEntradaTurno =
        crearFechaHoraPeru(
          fechaBase,
          horaEntrada
        );

      horaSalidaTurno =
        crearFechaHoraPeru(
          sumarDiasFecha(
            fechaBase,
            1
          ),
          horaSalida
        );
    }
  }

  const inicioPermitido =
    new Date(
      horaEntradaTurno.getTime()
    );

  inicioPermitido.setMinutes(
    inicioPermitido.getMinutes() -
      Math.max(
        margenEntradaAnticipadaMinutos,
        0
      )
  );

  const finPermitido =
    new Date(
      horaSalidaTurno.getTime()
    );

  finPermitido.setMinutes(
    finPermitido.getMinutes() +
      Math.max(
        margenSalidaMinutos,
        0
      )
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

function obtenerLimitePuntualidad(
  horaEntradaTurno: Date,
  margenMinutos: number
) {
  const limite =
    new Date(
      horaEntradaTurno.getTime()
    );

  limite.setMinutes(
    limite.getMinutes() +
      Math.max(
        margenMinutos,
        0
      )
  );

  return limite;
}

async function notificarTelegram({
  chatId,
  estudiante,
  tipo,
  hora,
  metodo,
  estado,
}: {
  chatId: string;
  estudiante: any;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
  metodo: string;
  estado: string;
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

👩‍🎓 Estudiante:
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

📷 Evidencia fotográfica disponible en el Portal Web de Padres.`;

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

    let fotoUrl =
      typeof body.fotoUrl === "string"
        ? body.fotoUrl.trim()
        : typeof body.foto === "string"
        ? body.foto.trim()
        : "";

    if (fotoUrl && (fotoUrl.startsWith("data:image/") || (fotoUrl.length > 500 && !fotoUrl.startsWith("http")))) {
      try {
        const matches = fotoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches
          ? Buffer.from(matches[2], "base64")
          : Buffer.from(fotoUrl, "base64");
        const mime = matches ? matches[1] : "image/jpeg";
        const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
        const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
        const blob = await put(
          `asistencias/${Date.now()}-${crypto.randomUUID()}.${ext}`,
          buffer,
          {
            access: "public",
            contentType: mime,
            token: token || undefined,
            addRandomSuffix: false,
          }
        );
        fotoUrl = blob.url;
      } catch (errorSubida) {
        console.error("Error subiendo foto base64 a Vercel Blob:", errorSubida);
      }
    }

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

    const [estudiante, configuracionCanales] =
      await Promise.all([
        prisma.estudiante.findFirst({
          where: {
            OR: condicionesBusqueda,
          },
          include: {
            turno: true,
          },
        }),
        prisma.configuracion.findFirst({
          select: {
            canalWhatsAppActivo: true,
            canalTelegramActivo: true,
          },
        }),
      ]);

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

    if (!estudiante.turno.estado) {
      return NextResponse.json(
        {
          message:
            `El turno ${estudiante.turno.nombre} asignado al estudiante se encuentra inactivo.`,
          turnoInactivo: true,
          turno: {
            id:
              estudiante.turno.id,
            nombre:
              estudiante.turno.nombre,
          },
        },
        {
          status: 409,
        }
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

    const ahora =
      new Date();

    const horaActual =
      formatoHora(ahora);

    const ventanaTurno =
      obtenerVentanaTurno({
        horaEntrada:
          estudiante.turno.horaEntrada,

        horaSalida:
          estudiante.turno.horaSalida,

        margenEntradaAnticipadaMinutos:
          estudiante.turno
            .margenEntradaAnticipadaMinutos,

        margenSalidaMinutos:
          estudiante.turno
            .margenSalidaMinutos,

        ahora,
      });

    /*
     * Se busca la asistencia dentro de la ventana
     * real del turno asignado al estudiante.
     * Esto también funciona para turnos que cruzan
     * la medianoche.
     */
    let asistencia =
      await prisma.asistencia.findFirst({
        where: {
          estudianteId:
            estudiante.id,

          fecha: {
            gte:
              ventanaTurno.inicioPermitido,

            lte:
              ventanaTurno.finPermitido,
          },
        },

        orderBy: {
          fecha: "desc",
        },
      });

    const limitePuntualidad =
      obtenerLimitePuntualidad(
        ventanaTurno
          .horaEntradaTurno,

        estudiante.turno
          .margenAlertaMinutos
      );

    const estadoAsistencia =
      ahora <= limitePuntualidad
        ? "PUNTUAL"
        : "TARDE";

    /*
     * REGISTRO DE ENTRADA
     */
    if (!asistencia) {
      if (
        ahora <
        ventanaTurno.inicioPermitido
      ) {
        return NextResponse.json(
          {
            message:
              `Todavía no está habilitado el ingreso para el turno ${estudiante.turno.nombre}. ` +
              `Puede marcar desde las ${formatoHora(
                ventanaTurno.inicioPermitido
              )}. ` +
              `Hora actual: ${horaActual}.`,

            fueraDeHorario: true,

            tipoRestriccion:
              "ENTRADA_ANTICIPADA",

            turno: {
              nombre:
                estudiante.turno.nombre,

              horaEntrada:
                estudiante.turno.horaEntrada,

              horaSalida:
                estudiante.turno.horaSalida,

              margenEntradaAnticipadaMinutos:
                estudiante.turno
                  .margenEntradaAnticipadaMinutos,

              margenSalidaMinutos:
                estudiante.turno
                  .margenSalidaMinutos,
            },
          },
          {
            status: 409,
          }
        );
      }

      if (
        ahora >
        ventanaTurno.horaSalidaTurno
      ) {
        return NextResponse.json(
          {
            message:
              `El horario de entrada del turno ${estudiante.turno.nombre} ya terminó. ` +
              `La entrada se permite hasta las ${formatoHora(
                ventanaTurno.horaSalidaTurno
              )}. ` +
              `Hora actual: ${horaActual}.`,

            fueraDeHorario: true,

            tipoRestriccion:
              "ENTRADA_FINALIZADA",

            turno: {
              nombre:
                estudiante.turno.nombre,

              horaEntrada:
                estudiante.turno.horaEntrada,

              horaSalida:
                estudiante.turno.horaSalida,
            },
          },
          {
            status: 409,
          }
        );
      }

      asistencia =
        await prisma.asistencia.create({
          data: {
            estudianteId: estudiante.id,
            fecha: ahora,
            horaEntrada: ahora,
            metodo,
            estado: estadoAsistencia,
            fotoUrl,
            fotoEntrada: fotoUrl,
          },
        });

      // Notificaciones externas en segundo plano (NO bloqueantes ni obligatorias)
      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
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
        }).catch((error) => {
          console.error("Error no crítico enviando WhatsApp:", error);
        });
      }

      if (configuracionCanales?.canalTelegramActivo && estudiante.telegramChatId) {
        notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "ENTRADA",
          hora: horaActual,
          metodo,
          estado: estadoAsistencia,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
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
      if (
        ahora <
        ventanaTurno.horaSalidaTurno
      ) {
        return NextResponse.json(
          {
            message:
              `El estudiante ya registró entrada hoy. ` +
              `La salida estará habilitada desde las ${formatoHora(
                ventanaTurno.horaSalidaTurno
              )} del turno ${estudiante.turno.nombre}.`,

            salidaAunNoDisponible:
              true,

            turno: {
              nombre:
                estudiante.turno.nombre,

              horaSalida:
                estudiante.turno.horaSalida,

              margenSalidaMinutos:
                estudiante.turno
                  .margenSalidaMinutos,
            },
          },
          {
            status: 409,
          }
        );
      }

      if (
        ahora >
        ventanaTurno.finPermitido
      ) {
        return NextResponse.json(
          {
            message:
              `El horario para registrar salida del turno ${estudiante.turno.nombre} ya terminó. ` +
              `La salida estuvo habilitada hasta las ${formatoHora(
                ventanaTurno.finPermitido
              )}. ` +
              `Hora actual: ${horaActual}.`,

            fueraDeHorario: true,

            tipoRestriccion:
              "SALIDA_FINALIZADA",

            turno: {
              nombre:
                estudiante.turno.nombre,

              horaSalida:
                estudiante.turno.horaSalida,

              margenSalidaMinutos:
                estudiante.turno
                  .margenSalidaMinutos,
            },
          },
          {
            status: 409,
          }
        );
      }

      /*
       * Se conserva fotoUrl como fotografía de entrada.
       * Si se tomó foto al salir, se registra en fotoSalida.
       */
      asistencia =
        await prisma.asistencia.update({
          where: {
            id: asistencia.id,
          },
          data: {
            horaSalida: ahora,
            ...(fotoUrl ? { fotoSalida: fotoUrl } : {}),
            ...(!asistencia.fotoUrl && fotoUrl ? { fotoUrl } : {}),
          },
        });

      // Notificaciones externas en segundo plano (NO bloqueantes ni obligatorias)
      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
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
        }).catch((error) => {
          console.error("Error no crítico enviando WhatsApp:", error);
        });
      }

      if (configuracionCanales?.canalTelegramActivo && estudiante.telegramChatId) {
        notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "SALIDA",
          hora: horaActual,
          metodo,
          estado: asistencia.estado,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
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