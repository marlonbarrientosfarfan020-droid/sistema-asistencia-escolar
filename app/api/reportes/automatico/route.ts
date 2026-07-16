import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  esCronAutorizado,
  respuestaCronNoAutorizado,
} from "@/lib/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    !Number.isInteger(horas) ||
    !Number.isInteger(minutos) ||
    horas < 0 ||
    horas > 23 ||
    minutos < 0 ||
    minutos > 59
  ) {
    return 0;
  }

  return horas * 60 + minutos;
}

export async function GET(request: Request) {
  if (!esCronAutorizado(request)) {
    return respuestaCronNoAutorizado();
  }

  try {
    const configuracion =
      await prisma.configuracion.findFirst();

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No existe configuración institucional",
        },
        {
          status: 404,
        }
      );
    }

    if (!configuracion.reporteTelegramActivo) {
      return NextResponse.json({
        ok: false,
        omitido: true,
        message:
          "El reporte automático está desactivado",
      });
    }

    const horaActual = horaPeruActual();
    const fechaHoy = fechaPeruActual();

    /*
     * Se permite ejecutar algunos minutos después
     * de la hora programada.
     */
    if (
      minutosHora(horaActual) <
      minutosHora(
        configuracion.horaReporteDiario
      )
    ) {
      return NextResponse.json({
        ok: false,
        omitido: true,
        message:
          `Aún no corresponde el envío. ` +
          `Actual: ${horaActual}, ` +
          `configurada: ${configuracion.horaReporteDiario}`,
      });
    }

    /*
     * Evita repetir el reporte el mismo día.
     */
    if (configuracion.ultimoReporteTelegramAt) {
      const ultimaFecha = fechaPeruDeDate(
        configuracion.ultimoReporteTelegramAt
      );

      if (ultimaFecha === fechaHoy) {
        return NextResponse.json({
          ok: false,
          omitido: true,
          message:
            "El reporte de hoy ya fue enviado",
        });
      }
    }

    /*
     * CalendarioEscolar usa columnas @db.Date.
     * Por eso se compara con medianoche UTC.
     */
    const fechaHoyBD = new Date(
      `${fechaHoy}T00:00:00.000Z`
    );

    const eventoNoLectivoGeneral =
      await prisma.calendarioEscolar.findFirst({
        where: {
          estado: true,
          todosLosTurnos: true,
          fechaInicio: {
            lte: fechaHoyBD,
          },
          fechaFin: {
            gte: fechaHoyBD,
          },
        },
      });

    if (eventoNoLectivoGeneral) {
      await prisma.configuracion.update({
        where: {
          id: configuracion.id,
        },
        data: {
          ultimoReporteTelegramEstado:
            `📅 No enviado: día no lectivo ` +
            `(${eventoNoLectivoGeneral.descripcion})`,
        },
      });

      return NextResponse.json({
        ok: true,
        omitido: true,
        diaNoLectivo: true,
        message:
          `Reporte omitido porque hoy es día no lectivo: ` +
          `${eventoNoLectivoGeneral.descripcion}`,
        evento: {
          id: eventoNoLectivoGeneral.id,
          tipo: eventoNoLectivoGeneral.tipo,
          descripcion:
            eventoNoLectivoGeneral.descripcion,
          fechaInicio:
            eventoNoLectivoGeneral.fechaInicio,
          fechaFin:
            eventoNoLectivoGeneral.fechaFin,
        },
      });
    }

    const appUrl =
      process.env.APP_URL ||
      new URL(request.url).origin;

    const cronSecret =
      process.env.CRON_SECRET;

    if (!cronSecret) {
      throw new Error(
        "CRON_SECRET no está configurado"
      );
    }

    const respuesta = await fetch(
      `${appUrl}/api/reportes/telegram-diario`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${cronSecret}`,
        },
        cache: "no-store",
      }
    );

    const resultado = await respuesta
      .json()
      .catch(() => ({
        message:
          "La ruta del reporte no devolvió JSON",
      }));

    if (!respuesta.ok) {
      await prisma.configuracion.update({
        where: {
          id: configuracion.id,
        },
        data: {
          ultimoReporteTelegramEstado:
            "❌ Error automático",
        },
      });

      return NextResponse.json(
        {
          ok: false,
          message:
            resultado.message ||
            "Error al enviar el reporte automático",
          detalle: resultado,
        },
        {
          status: respuesta.status,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Reporte automático enviado correctamente",
      resultado,
    });
  } catch (error) {
    console.error(
      "Error en reporte automático:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error interno del reporte automático",
      },
      {
        status: 500,
      }
    );
  }
}