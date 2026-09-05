import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { enviarWhatsApp } from "@/services/whatsapp";
import { enviarTelegram } from "@/lib/telegram";
import {
  exigirAdminDemoOPersonal,
  exigirAdminOPersonal,
} from "@/lib/auth";
import {
  fechaPeru,
  horaPeru,
  formatoHora12,
  formatoHora,
  obtenerLimitesDiaPeru,
  obtenerVentanaTurno,
  calcularEstadoAsistencia,
} from "@/lib/timezone";

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
      const limites = obtenerLimitesDiaPeru(fecha);
      inicioDia = limites.inicioDia;
      finDia = limites.finDia;
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
        turno: true,
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

async function obtenerEventoNoLectivo(turnoId: number | null) {
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
  const acceso = await exigirAdminOPersonal(request);

  if (!acceso.autorizado) {
    console.warn("[ASISTENCIA API] Acceso denegado en /api/asistencias");
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
        : typeof body.foto === "string"
        ? body.foto.trim()
        : "";

    if (!dni && !codigo) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debe ingresar el DNI o código del estudiante",
        },
        { status: 400 }
      );
    }

    // Validación estricta de evidencia fotográfica (flujo único)
    if (!fotoUrl || !fotoUrl.startsWith("http")) {
      return NextResponse.json(
        {
          ok: false,
          message: "No se pudo guardar evidencia fotográfica",
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
          ok: false,
          message: "Estudiante no encontrado",
        },
        { status: 404 }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        {
          ok: false,
          message: "Estudiante inactivo",
        },
        { status: 400 }
      );
    }

    if (!estudiante.turno) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El estudiante no tiene turno asignado. Asigne un turno antes de registrar asistencia.",
        },
        { status: 400 }
      );
    }

    // Regla: Si un turno está INACTIVO, no debe permitir marcar asistencia
    if (!estudiante.turno.estado) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `El turno ${estudiante.turno.nombre} no está habilitado actualmente`,
          turnoInactivo: true,
          turno: {
            id: estudiante.turno.id,
            nombre: estudiante.turno.nombre,
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
          ok: false,
          message: `Hoy no se registra asistencia porque es un día no lectivo: ${eventoNoLectivo.descripcion}. Aplica para ${alcance}.`,
          diaNoLectivo: true,
          evento: {
            id: eventoNoLectivo.id,
            tipo: eventoNoLectivo.tipo,
            descripcion: eventoNoLectivo.descripcion,
          },
        },
        { status: 409 }
      );
    }

    const ahora = new Date();
    const fechaDia = fechaPeru(ahora);
    const horaActual12 = formatoHora12(ahora);

    const ventanaTurno =
      obtenerVentanaTurno({
        horaEntrada: estudiante.turno.horaEntrada,
        horaSalida: estudiante.turno.horaSalida,
        margenEntradaAnticipadaMinutos: estudiante.turno.margenEntradaAnticipadaMinutos,
        margenSalidaMinutos: estudiante.turno.margenSalidaMinutos,
        ahora,
      });

    // 1. Búsqueda por clave de unicidad (estudianteId + fechaDia + turnoId)
    let asistencia =
      await prisma.asistencia.findFirst({
        where: {
          estudianteId: estudiante.id,
          fechaDia,
          turnoId: estudiante.turno.id,
        },
        orderBy: {
          id: "desc",
        },
      });

    // 2. Fallback por ventana de turno si fechaDia no estuviera asignada
    if (!asistencia) {
      asistencia =
        await prisma.asistencia.findFirst({
          where: {
            estudianteId: estudiante.id,
            fecha: {
              gte: ventanaTurno.inicioPermitido,
              lte: ventanaTurno.finPermitido,
            },
          },
          orderBy: {
            id: "desc",
          },
        });
    }

    /*
     * CASO A: REGISTRO DE ENTRADA (Primera marcación del día)
     */
    if (!asistencia) {
      if (ahora < ventanaTurno.inicioPermitido) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `Todavía no está habilitado el ingreso para el turno ${estudiante.turno.nombre}. ` +
              `Puede marcar desde las ${formatoHora12(ventanaTurno.inicioPermitido)}. ` +
              `Hora actual: ${horaActual12}.`,
            fueraDeHorario: true,
            tipoRestriccion: "ENTRADA_ANTICIPADA",
            turno: {
              nombre: estudiante.turno.nombre,
              horaEntrada: estudiante.turno.horaEntrada,
              horaSalida: estudiante.turno.horaSalida,
            },
          },
          { status: 409 }
        );
      }

      if (ahora > ventanaTurno.horaSalidaTurno) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `El horario de entrada del turno ${estudiante.turno.nombre} ya terminó. ` +
              `La entrada se permite hasta las ${formatoHora12(ventanaTurno.horaSalidaTurno)}. ` +
              `Hora actual: ${horaActual12}.`,
            fueraDeHorario: true,
            tipoRestriccion: "ENTRADA_FINALIZADA",
            turno: {
              nombre: estudiante.turno.nombre,
              horaEntrada: estudiante.turno.horaEntrada,
              horaSalida: estudiante.turno.horaSalida,
            },
          },
          { status: 409 }
        );
      }

      const estadoAsistencia = calcularEstadoAsistencia(
        ahora,
        ventanaTurno.horaEntradaTurno,
        estudiante.turno.margenAlertaMinutos
      );

      console.log("[ASISTENCIA API] Creando entrada para estudiante:", estudiante.id, "Turno:", estudiante.turno.nombre, "Estado:", estadoAsistencia);

      try {
        asistencia =
          await prisma.asistencia.create({
            data: {
              estudianteId: estudiante.id,
              fecha: ahora,
              fechaDia,
              turnoId: estudiante.turno.id,
              horaEntrada: ahora,
              metodo,
              estado: estadoAsistencia,
              fotoUrl,
              fotoEntrada: fotoUrl,
            },
          });
      } catch (errDb: any) {
        // Manejo de condición de carrera con restricción única P2002
        if (errDb instanceof Prisma.PrismaClientKnownRequestError && errDb.code === "P2002") {
          console.warn("[ASISTENCIA API] Detección de marcación concurrente P2002 para estudiante:", estudiante.id);
          const yaExiste = await prisma.asistencia.findFirst({
            where: {
              estudianteId: estudiante.id,
              fechaDia,
              turnoId: estudiante.turno.id,
            },
          });
          const horaReg = formatoHora12(yaExiste?.horaEntrada || yaExiste?.fecha || ahora);
          return NextResponse.json(
            {
              ok: true,
              yaRegistrado: true,
              tipo: "ENTRADA",
              estado: yaExiste?.estado || estadoAsistencia,
              estudiante,
              asistencia: yaExiste,
              message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró asistencia hoy a las ${horaReg}`,
            },
            { status: 409 }
          );
        }
        throw errDb;
      }

      console.log("[ASISTENCIA API] Registro de entrada exitoso id:", asistencia.id);

      // Notificaciones externas en segundo plano (NO bloqueantes)
      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "ENTRADA",
          hora: horaActual12,
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
          hora: horaActual12,
          metodo,
          estado: estadoAsistencia,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
      }

      return NextResponse.json({
        ok: true,
        tipo: "ENTRADA",
        estado: estadoAsistencia,
        estudiante,
        asistencia,
        message: "Asistencia registrada correctamente",
      });
    }

    /*
     * CASO B: EL ESTUDIANTE YA TIENE REGISTRADA ENTRADA
     */
    if (!asistencia.horaSalida) {
      // Si todavía no es hora de salida, es una marcación repetida
      if (ahora < ventanaTurno.horaSalidaTurno) {
        const horaReg = formatoHora12(asistencia.horaEntrada || asistencia.fecha);
        return NextResponse.json(
          {
            ok: true,
            yaRegistrado: true,
            salidaAunNoDisponible: true,
            tipo: "ENTRADA",
            estado: asistencia.estado,
            estudiante,
            asistencia,
            message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró asistencia hoy a las ${horaReg}`,
            turno: {
              nombre: estudiante.turno.nombre,
              horaSalida: estudiante.turno.horaSalida,
            },
          },
          { status: 409 }
        );
      }

      // Si ya pasó el fin permitido para marcar salida
      if (ahora > ventanaTurno.finPermitido) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `El horario para registrar salida del turno ${estudiante.turno.nombre} ya terminó. ` +
              `La salida estuvo habilitada hasta las ${formatoHora12(ventanaTurno.finPermitido)}. ` +
              `Hora actual: ${horaActual12}.`,
            fueraDeHorario: true,
            tipoRestriccion: "SALIDA_FINALIZADA",
          },
          { status: 409 }
        );
      }

      // REGISTRO DE SALIDA
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

      console.log("[ASISTENCIA API] Registro de salida exitoso id:", asistencia.id);

      // Notificaciones externas en segundo plano (NO bloqueantes)
      if (configuracionCanales?.canalWhatsAppActivo && estudiante.whatsapp) {
        enviarWhatsApp({
          telefono: estudiante.whatsapp,
          tutor: estudiante.nombreTutor,
          estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
          tipo: "SALIDA",
          hora: horaActual12,
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
          hora: horaActual12,
          metodo,
          estado: asistencia.estado,
        }).catch((error) => {
          console.error("Error no crítico enviando Telegram:", error);
        });
      }

      return NextResponse.json({
        ok: true,
        tipo: "SALIDA",
        estado: asistencia.estado,
        estudiante,
        asistencia,
        message: "Salida registrada correctamente",
      });
    }

    /*
     * CASO C: YA REGISTRÓ ENTRADA Y SALIDA HOY
     */
    return NextResponse.json(
      {
        ok: true,
        yaRegistrado: true,
        message: `El estudiante ${estudiante.nombres} ${estudiante.apellidos} ya registró entrada y salida hoy`,
        asistencia,
        estudiante,
      },
      { status: 409 }
    );
  } catch (error) {
    console.error(
      "Error registrando asistencia:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Error al registrar asistencia",
      },
      { status: 500 }
    );
  }
}