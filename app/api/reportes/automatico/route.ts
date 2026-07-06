import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function horaPeruActual() {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function fechaPeruActual() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fechaPeruDeDate(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

export async function GET(request: Request) {
  try {
    const configuracion = await prisma.configuracion.findFirst();

    if (!configuracion?.reporteTelegramActivo) {
      return NextResponse.json({
        ok: false,
        message: "Reporte automático desactivado",
      });
    }

    const horaActual = horaPeruActual();
    const fechaHoy = fechaPeruActual();

    if (horaActual !== configuracion.horaReporteDiario) {
      return NextResponse.json({
        ok: false,
        message: `Aún no es la hora. Actual: ${horaActual}, configurada: ${configuracion.horaReporteDiario}`,
      });
    }

    if (configuracion.ultimoReporteTelegramAt) {
      const ultimaFecha = fechaPeruDeDate(configuracion.ultimoReporteTelegramAt);

      if (ultimaFecha === fechaHoy) {
        return NextResponse.json({
          ok: false,
          message: "El reporte de hoy ya fue enviado",
        });
      }
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const res = await fetch(`${baseUrl}/api/reportes/telegram-diario`, {
      headers: {
        "x-user-role": "ADMIN",
      },
    });

    if (!res.ok) {
      await prisma.configuracion.update({
        where: { id: configuracion.id },
        data: {
          ultimoReporteTelegramAt: new Date(),
          ultimoReporteTelegramEstado: "❌ Error automático",
        },
      });

      return NextResponse.json(
        { ok: false, message: "Error al enviar reporte automático" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Reporte automático enviado correctamente",
    });
  } catch (error) {
    console.error("Error reporte automático:", error);

    return NextResponse.json(
      { ok: false, message: "Error interno del reporte automático" },
      { status: 500 }
    );
  }
}