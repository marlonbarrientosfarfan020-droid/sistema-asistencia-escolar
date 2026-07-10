import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsApp } from "@/services/whatsapp";
import { enviarTelegram, enviarFotoTelegram } from "@/lib/telegram";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha");

  let inicioDia: Date | undefined;
  let finDia: Date | undefined;

  if (fecha) {
    inicioDia = new Date(`${fecha}T00:00:00`);
    finDia = new Date(`${fecha}T23:59:59`);
  }

  const asistencias = await prisma.asistencia.findMany({
    where: fecha ? { fecha: { gte: inicioDia, lte: finDia } } : {},
    orderBy: { fecha: "desc" },
    include: {
      estudiante: { include: { turno: true } },
    },
  });

  return NextResponse.json(asistencias);
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
async function obtenerEventoNoLectivo(turnoId: number | null) {
  const hoy = fechaPeru();

  const inicioDia = new Date(`${hoy}T00:00:00-05:00`);
  const finDia = new Date(`${hoy}T23:59:59.999-05:00`);

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
  const [hora, minuto] = horaSalida.split(":").map(Number);
  const fechaPermitida = new Date();
  fechaPermitida.setHours(hora, minuto, 0, 0);
  return fechaPermitida;
}

function convertirBase64ABuffer(fotoBase64: string) {
  const base64Limpio = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Limpio, "base64");
}

async function guardarFotoAsistencia({
  fotoBase64,
  dni,
  tipo,
}: {
  fotoBase64: string;
  dni: string;
  tipo: "ENTRADA" | "SALIDA";
}) {
  const fecha = fechaPeru();

  const carpeta = path.join(
    process.cwd(),
    "public",
    "uploads",
    "asistencias",
    fecha
  );

  await mkdir(carpeta, { recursive: true });

  const nombreArchivo = `${dni}_${tipo.toLowerCase()}_${Date.now()}.jpg`;
  const rutaCompleta = path.join(carpeta, nombreArchivo);

  const buffer = convertirBase64ABuffer(fotoBase64);

  await writeFile(rutaCompleta, buffer);

  return {
    buffer,
    rutaPublica: `/uploads/asistencias/${fecha}/${nombreArchivo}`,
  };
}

async function notificarTelegram({
  chatId,
  estudiante,
  tipo,
  hora,
  metodo,
  estado,
  fotoBuffer,
}: {
  chatId: string;
  estudiante: any;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
  metodo: string;
  estado: string;
  fotoBuffer?: Buffer | null;
}) {
  if (!chatId) return;

  const iconoEstado = estado === "TARDE" ? "🟠" : "🟢";

  const mensaje = `🏫 I.E. Santa Rita de Casia

${tipo === "ENTRADA" ? "✅ ENTRADA REGISTRADA" : "👋 SALIDA REGISTRADA"}

👨‍🎓 Estudiante:
${estudiante.nombres} ${estudiante.apellidos}

📚 Grado:
${estudiante.grado} - ${estudiante.seccion}

⏰ Turno:
${estudiante.turno?.nombre || "Sin turno"} (${estudiante.turno?.horaEntrada || "--:--"} - ${estudiante.turno?.horaSalida || "--:--"})

${iconoEstado} Estado:
${estado}

🕒 Hora:
${hora}

📌 Método:
${metodo}

📷 Foto capturada al momento de marcar asistencia.`;

  if (fotoBuffer) {
    await enviarFotoTelegram(chatId, fotoBuffer, mensaje);
  } else {
    await enviarTelegram(chatId, mensaje);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const dni = String(body.dni || "").trim();
    const codigo = String(body.codigo || "").trim();
    const metodo = String(body.metodo || "DNI").trim();
    const fotoBase64 = String(body.fotoBase64 || "").trim();


    const estudiante = await prisma.estudiante.findFirst({
      where: {
        OR: [{ dni }, { codigo }],
      },
      include: {
        turno: true,
      },
    });

    if (!estudiante) {
      return NextResponse.json(
        { message: "Estudiante no encontrado" },
        { status: 404 }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        { message: "Estudiante inactivo" },
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
    const eventoNoLectivo = await obtenerEventoNoLectivo(estudiante.turnoId);

if (eventoNoLectivo) {
  const alcance = eventoNoLectivo.todosLosTurnos
    ? "todos los turnos"
    : `el turno ${
        eventoNoLectivo.turno?.nombre || estudiante.turno.nombre
      }`;

  return NextResponse.json(
    {
      message: `Hoy no se registra asistencia porque es un día no lectivo: ${eventoNoLectivo.descripcion}. Aplica para ${alcance}.`,
      diaNoLectivo: true,
      evento: {
        id: eventoNoLectivo.id,
        tipo: eventoNoLectivo.tipo,
        descripcion: eventoNoLectivo.descripcion,
        fechaInicio: eventoNoLectivo.fechaInicio,
        fechaFin: eventoNoLectivo.fechaFin,
        todosLosTurnos: eventoNoLectivo.todosLosTurnos,
        turno: eventoNoLectivo.turno?.nombre || null,
      },
    },
    { status: 409 }
  );
}

if (!fotoBase64) {
  return NextResponse.json(
    { message: "La foto del estudiante es obligatoria" },
    { status: 400 }
  );
}

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    let asistencia = await prisma.asistencia.findFirst({
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

    const [horaEntrada, minutoEntrada] = estudiante.turno.horaEntrada
      .split(":")
      .map(Number);

    const horaPermitida = new Date();
    horaPermitida.setHours(horaEntrada, minutoEntrada, 0, 0);

    const estadoAsistencia = ahora <= horaPermitida ? "PUNTUAL" : "TARDE";

    if (!asistencia) {
      const foto = await guardarFotoAsistencia({
        fotoBase64,
        dni: estudiante.dni,
        tipo: "ENTRADA",
      });

      asistencia = await prisma.asistencia.create({
        data: {
          estudianteId: estudiante.id,
          fecha: ahora,
          horaEntrada: ahora,
          metodo,
          estado: estadoAsistencia,
          fotoEntrada: foto.rutaPublica,
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
        console.error("Error enviando WhatsApp:", error);
      }

      try {
        await notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "ENTRADA",
          hora: horaActual,
          metodo,
          estado: estadoAsistencia,
          fotoBuffer: foto.buffer,
        });
      } catch (error) {
        console.error("Error enviando Telegram:", error);
      }

      return NextResponse.json({
        tipo: "ENTRADA",
        estudiante,
        asistencia,
        message: "Entrada registrada correctamente",
      });
    }

    if (!asistencia.horaSalida) {
      const horaSalidaPermitida = horaTurnoPermitida(
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

      const foto = await guardarFotoAsistencia({
        fotoBase64,
        dni: estudiante.dni,
        tipo: "SALIDA",
      });

      asistencia = await prisma.asistencia.update({
        where: { id: asistencia.id },
        data: {
          horaSalida: ahora,
          fotoSalida: foto.rutaPublica,
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
        console.error("Error enviando WhatsApp:", error);
      }

      try {
        await notificarTelegram({
          chatId: estudiante.telegramChatId,
          estudiante,
          tipo: "SALIDA",
          hora: horaActual,
          metodo,
          estado: asistencia.estado,
          fotoBuffer: foto.buffer,
        });
      } catch (error) {
        console.error("Error enviando Telegram:", error);
      }

      return NextResponse.json({
        tipo: "SALIDA",
        estudiante,
        asistencia,
        message: "Salida registrada correctamente",
      });
    }

    return NextResponse.json(
      { message: "El estudiante ya registró entrada y salida hoy" },
      { status: 400 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al registrar asistencia" },
      { status: 500 }
    );
  }
}