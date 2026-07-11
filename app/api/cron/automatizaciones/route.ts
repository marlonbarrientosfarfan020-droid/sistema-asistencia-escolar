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

function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function horaPeru() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function diaSemanaPeru() {
  const dia = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
  }).format(new Date());

  const equivalencias: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return equivalencias[dia] || 1;
}

function mismaFechaPeru(fecha: Date | null | undefined) {
  if (!fecha) return false;

  const fechaGuardada = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);

  return fechaGuardada === fechaPeru();
}

function mismaSemana(
  fechaA: Date | null | undefined,
  fechaB: Date
) {
  if (!fechaA) return false;

  const obtenerLunes = (fecha: Date) => {
    const fechaTexto = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(fecha);

    const base = new Date(`${fechaTexto}T12:00:00-05:00`);
    const dia = base.getDay();
    const diferencia = dia === 0 ? -6 : 1 - dia;

    base.setDate(base.getDate() + diferencia);

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(base);
  };

  return obtenerLunes(fechaA) === obtenerLunes(fechaB);
}

async function ejecutarRuta(
  ruta: string,
  metodo: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
) {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL no está configurado");
  }

  const respuesta = await fetch(`${appUrl}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      ...(body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = await respuesta.json().catch(() => ({
    message: "La ruta no devolvió JSON",
  }));

  return {
    ok: respuesta.ok,
    status: respuesta.status,
    data,
  };
}

export async function GET(request: Request) {
  if (!esCronAutorizado(request)) {
    return respuestaCronNoAutorizado();
  }

  const inicio = Date.now();

  try {
    const configuracion = await prisma.configuracion.findFirst();

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          message: "No existe configuración institucional",
        },
        {
          status: 404,
        }
      );
    }

    const horaActual = horaPeru();
    const diaActual = diaSemanaPeru();
    const ahora = new Date();

    const resultados: Record<string, unknown> = {
      fecha: fechaPeru(),
      hora: horaActual,
    };

    /*
     * 1. ALERTAS DE AUSENCIA
     *
     * Se ejecuta en cada llamada.
     * La propia ruta debe validar:
     * - margen del turno;
     * - día no lectivo;
     * - asistencia ya registrada;
     * - alerta ya enviada.
     */
    resultados.alertasAusencia = await ejecutarRuta(
      "/api/alertas/ausentes"
    );

    /*
     * 2. REPORTE PARA EL DIRECTOR
     */
    if (configuracion.reporteDirectorActivo) {
      const esHoraDirector =
        horaActual === configuracion.horaReporteDirector;

      const esDiaDirector =
        configuracion.frecuenciaReporteDirector === "DIARIO" ||
        diaActual === configuracion.diaReporteDirector;

      const yaEnviadoDirector =
        configuracion.frecuenciaReporteDirector === "DIARIO"
          ? mismaFechaPeru(configuracion.ultimoReporteDirectorAt)
          : mismaSemana(
              configuracion.ultimoReporteDirectorAt,
              ahora
            );

      if (
        esHoraDirector &&
        esDiaDirector &&
        !yaEnviadoDirector
      ) {
        const resultadoDirector = await ejecutarRuta(
          "/api/reportes/telegram-diario"
        );

        resultados.reporteDirector = resultadoDirector;

        if (resultadoDirector.ok) {
          await prisma.configuracion.update({
            where: {
              id: configuracion.id,
            },
            data: {
              ultimoReporteDirectorAt: ahora,
            },
          });
        }
      } else {
        resultados.reporteDirector = {
          ejecutado: false,
          motivo: yaEnviadoDirector
            ? "Ya fue enviado en el periodo correspondiente"
            : "Todavía no corresponde el día o la hora",
        };
      }
    } else {
      resultados.reporteDirector = {
        ejecutado: false,
        motivo: "Reporte del director desactivado",
      };
    }

if (configuracion.reportePadresActivo) {
  const esHoraPadres =
    horaActual === configuracion.horaReportePadres;

  const yaEnviadoPadresHoy = mismaFechaPeru(
    configuracion.ultimoReportePadresAt
  );

  if (esHoraPadres && !yaEnviadoPadresHoy) {
    const resultadoPadres = await ejecutarRuta(
      "/api/reportes/padres-semanal",
      "POST",
      {
        forzarEnvio: false,
      }
    );

    resultados.reportePadres = resultadoPadres;
  } else {
    resultados.reportePadres = {
      ejecutado: false,
      motivo: yaEnviadoPadresHoy
        ? "Los reportes para padres ya fueron enviados hoy"
        : `Todavía no corresponde la hora. Actual: ${horaActual}, configurada: ${configuracion.horaReportePadres}`,
    };
  }
} else {
  resultados.reportePadres = {
    ejecutado: false,
    motivo: "Reportes para padres desactivados",
  };
}

 return NextResponse.json({
  ok: true,
  message: "Verificación automática finalizada",
  duracionMs: Date.now() - inicio,
  resultados,
});
  } catch (error) {
    console.error("Error en automatizaciones:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error en el motor de automatizaciones",
        duracionMs: Date.now() - inicio,
      },
      {
        status: 500,
      }
    );
  }
}