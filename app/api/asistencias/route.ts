import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsApp } from "@/services/whatsapp";
import { enviarTelegram } from "@/lib/telegram";

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
    where: fecha
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
      estudiante: true,
    },
  });

  return NextResponse.json(asistencias);
}

function formatoHora(fecha: Date) {
  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function notificarTelegram({
  chatId,
  estudiante,
  tipo,
  hora,
}: {
  chatId: string;
  estudiante: any;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
}) {
  if (!chatId) return;

  await enviarTelegram(
    chatId,
    `🏫 I.E. Santa Rita de Casia

${tipo === "ENTRADA" ? "✅ ENTRADA REGISTRADA" : "👋 SALIDA REGISTRADA"}

👨‍🎓 Estudiante:
${estudiante.nombres} ${estudiante.apellidos}

📚 Grado:
${estudiante.grado} - ${estudiante.seccion}

🕒 Hora:
${hora}

📌 Método:
Sistema de Asistencia Escolar`
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dni = String(body.dni || "").trim();
    const codigo = String(body.codigo || "").trim();
    const metodo = body.metodo;

    const estudiante = await prisma.estudiante.findFirst({
      where: {
        OR: [{ dni }, { codigo }],
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

    if (!asistencia) {
      asistencia = await prisma.asistencia.create({
        data: {
          estudianteId: estudiante.id,
          fecha: ahora,
          horaEntrada: ahora,
          metodo: metodo || "DNI",
        },
      });

      enviarWhatsApp({
        telefono: estudiante.whatsapp,
        tutor: estudiante.nombreTutor,
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        tipo: "ENTRADA",
        hora: horaActual,
      });

      await notificarTelegram({
        chatId: estudiante.telegramChatId,
        estudiante,
        tipo: "ENTRADA",
        hora: horaActual,
      });

      return NextResponse.json({
        tipo: "ENTRADA",
        estudiante,
        asistencia,
        message: "Entrada registrada correctamente",
      });
    }

    if (!asistencia.horaSalida) {
      if (asistencia.horaEntrada) {
        const minutosDesdeEntrada =
          (ahora.getTime() - asistencia.horaEntrada.getTime()) / 1000 / 60;

        const minutosMinimosParaSalida = 1;

        if (minutosDesdeEntrada < minutosMinimosParaSalida) {
          return NextResponse.json(
            {
              message: `Salida bloqueada. Deben pasar al menos ${minutosMinimosParaSalida} minutos desde la entrada.`,
            },
            { status: 400 }
          );
        }
      }

      asistencia = await prisma.asistencia.update({
        where: { id: asistencia.id },
        data: {
          horaSalida: ahora,
        },
      });

      enviarWhatsApp({
        telefono: estudiante.whatsapp,
        tutor: estudiante.nombreTutor,
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        tipo: "SALIDA",
        hora: horaActual,
      });

      await notificarTelegram({
        chatId: estudiante.telegramChatId,
        estudiante,
        tipo: "SALIDA",
        hora: horaActual,
      });

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