import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ZONA_HORARIA = "America/Lima";

function horaPeruActual() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function fechaPeruActual() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fechaPeruDeDate(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function minutosHora(hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);

  if (
    !Number.isFinite(horas) ||
    !Number.isFinite(minutos)
  ) {
    return 0;
  }

  return horas * 60 + minutos;
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

    /*
     * Usamos >= en lugar de igualdad exacta.
     * Así funciona aunque el cron se ejecute algunos minutos después.
     */
    if (
      minutosHora(horaActual) <
      minutosHora(configuracion.horaReporteDiario)
    ) {
      return NextResponse.json({
        ok: false,
        message: `Aún no es la hora. Actual: ${horaActual}, configurada: ${configuracion.horaReporteDiario}`,
      });
    }

    if (configuracion.ultimoReporteTelegramAt) {
      const ultimaFecha = fechaPeruDeDate(
        configuracion.ultimoReporteTelegramAt
      );

      if (ultimaFecha === fechaHoy) {
        return NextResponse.json({
          ok: false,
          message: "El reporte de hoy ya fue enviado",
        });
      }
    }

    const inicioDia = new Date(`${fechaHoy}T00:00:00-05:00`);
    const finDia = new Date(`${fechaHoy}T23:59:59.999-05:00`);

    /*
     * Solo se detiene completamente el reporte si el evento
     * aplica a todos los turnos.
     */
    const eventoNoLectivoGeneral =
      await prisma.calendarioEscolar.findFirst({
        where: {
          estado: true,
          todosLosTurnos: true,
          fechaInicio: {
            lte: finDia,
          },
          fechaFin: {
            gte: inicioDia,
          },
        },
      });

    if (eventoNoLectivoGeneral) {
      await prisma.configuracion.update({
        where: {
          id: configuracion.id,
        },
        data: {
          ultimoReporteTelegramEstado: `📅 No enviado: día no lectivo (${eventoNoLectivoGeneral.descripcion})`,
        },
      });

      return NextResponse.json({
        ok: true,
        omitido: true,
        diaNoLectivo: true,
        message: `Reporte omitido porque hoy es día no lectivo: ${eventoNoLectivoGeneral.descripcion}`,
        evento: {
          id: eventoNoLectivoGeneral.id,
          tipo: eventoNoLectivoGeneral.tipo,
          descripcion: eventoNoLectivoGeneral.descripcion,
          fechaInicio: eventoNoLectivoGeneral.fechaInicio,
          fechaFin: eventoNoLectivoGeneral.fechaFin,
        },
      });
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const respuesta = await fetch(
      `${baseUrl}/api/reportes/telegram-diario`,
      {
        headers: {
          "x-user-role": "ADMIN",
        },
        cache: "no-store",
      }
    );

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      await prisma.configuracion.update({
        where: {
          id: configuracion.id,
        },
        data: {
          ultimoReporteTelegramEstado: "❌ Error automático",
        },
      });

      return NextResponse.json(
        {
          ok: false,
          message:
            resultado.message ||
            "Error al enviar reporte automático",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Reporte automático enviado correctamente",
      resultado,
    });
  } catch (error) {
    console.error("Error reporte automático:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno del reporte automático",
      },
      { status: 500 }
    );
  }
}