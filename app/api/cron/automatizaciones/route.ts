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

function diaMesPeru() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA_HORARIA,
      day: "2-digit",
    }).format(new Date())
  );
}

function obtenerPeriodoSemana(fecha: Date) {
  const texto = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);

  const base = new Date(`${texto}T12:00:00-05:00`);
  const dia = base.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;

  base.setDate(base.getDate() + diferencia);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

function mismaSemana(
  fechaA: Date | null | undefined,
  fechaB: Date
) {
  if (!fechaA) return false;

  return (
    obtenerPeriodoSemana(fechaA) ===
    obtenerPeriodoSemana(fechaB)
  );
}

function obtenerMesPeru(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
  }).format(fecha);
}

function mismoMes(
  fechaA: Date | null | undefined,
  fechaB: Date
) {
  if (!fechaA) return false;

  return obtenerMesPeru(fechaA) === obtenerMesPeru(fechaB);
}

function correspondePeriodo({
  frecuencia,
  diaSemanaConfigurado,
  diaMesConfigurado,
  diaSemanaActual,
  diaMesActual,
}: {
  frecuencia: string;
  diaSemanaConfigurado: number;
  diaMesConfigurado: number;
  diaSemanaActual: number;
  diaMesActual: number;
}) {
  if (frecuencia === "MENSUAL") {
    return diaMesActual === diaMesConfigurado;
  }

  return diaSemanaActual === diaSemanaConfigurado;
}

function yaFueEnviado({
  frecuencia,
  ultimoEnvio,
  ahora,
}: {
  frecuencia: string;
  ultimoEnvio: Date | null | undefined;
  ahora: Date;
}) {
  if (frecuencia === "MENSUAL") {
    return mismoMes(ultimoEnvio, ahora);
  }

  return mismaSemana(ultimoEnvio, ahora);
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
    const configuracion =
      await prisma.configuracion.findFirst();

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          message: "No existe configuración institucional",
        },
        { status: 404 }
      );
    }

    const ahora = new Date();
    const horaActual = horaPeru();
    const diaSemanaActual = diaSemanaPeru();
    const diaMesActual = diaMesPeru();

    const resultados: Record<string, unknown> = {
      fecha: fechaPeru(),
      hora: horaActual,
      diaSemana: diaSemanaActual,
      diaMes: diaMesActual,
    };

    /*
     * 1. ALERTAS DE AUSENCIA
     */
    resultados.alertasAusencia = await ejecutarRuta(
      "/api/alertas/ausentes"
    );

    /*
     * 2. REPORTE DEL DIRECTOR
     */
    if (configuracion.reporteDirectorActivo) {
      const frecuenciaDirector =
        configuracion.frecuenciaReporteDirector === "MENSUAL"
          ? "MENSUAL"
          : "SEMANAL";

      const esHoraDirector =
        horaActual === configuracion.horaReporteDirector;

      const correspondeDirector = correspondePeriodo({
        frecuencia: frecuenciaDirector,
        diaSemanaConfigurado:
          configuracion.diaReporteDirector,
        diaMesConfigurado:
          configuracion.diaMesReporteDirector,
        diaSemanaActual,
        diaMesActual,
      });

      const yaEnviadoDirector = yaFueEnviado({
        frecuencia: frecuenciaDirector,
        ultimoEnvio:
          configuracion.ultimoReporteDirectorAt,
        ahora,
      });

      if (
        esHoraDirector &&
        correspondeDirector &&
        !yaEnviadoDirector
      ) {
        const resultadoDirector = await ejecutarRuta(
          `/api/reportes/telegram-diario?frecuencia=${frecuenciaDirector}`
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
          frecuencia: frecuenciaDirector,
          motivo: yaEnviadoDirector
            ? `El reporte ${frecuenciaDirector.toLowerCase()} del director ya fue enviado`
            : !correspondeDirector
              ? "Hoy no corresponde el día configurado"
              : `Todavía no corresponde la hora. Actual: ${horaActual}, configurada: ${configuracion.horaReporteDirector}`,
        };
      }
    } else {
      resultados.reporteDirector = {
        ejecutado: false,
        motivo: "Reporte del director desactivado",
      };
    }

    /*
     * 3. REPORTES PARA PADRES
     */
    if (configuracion.reportePadresActivo) {
      const frecuenciaPadres =
        configuracion.frecuenciaReportePadres === "MENSUAL"
          ? "MENSUAL"
          : "SEMANAL";

      const esHoraPadres =
        horaActual === configuracion.horaReportePadres;

      const correspondePadres = correspondePeriodo({
        frecuencia: frecuenciaPadres,
        diaSemanaConfigurado:
          configuracion.diaReportePadres,
        diaMesConfigurado:
          configuracion.diaMesReportePadres,
        diaSemanaActual,
        diaMesActual,
      });

      const yaEnviadoPadres = yaFueEnviado({
        frecuencia: frecuenciaPadres,
        ultimoEnvio:
          configuracion.ultimoReportePadresAt,
        ahora,
      });

      if (
        esHoraPadres &&
        correspondePadres &&
        !yaEnviadoPadres
      ) {
        const resultadoPadres = await ejecutarRuta(
          "/api/reportes/padres-semanal",
          "POST",
          {
            forzarEnvio: false,
            frecuencia: frecuenciaPadres,
          }
        );

        resultados.reportePadres = resultadoPadres;
      } else {
        resultados.reportePadres = {
          ejecutado: false,
          frecuencia: frecuenciaPadres,
          motivo: yaEnviadoPadres
            ? `Los reportes ${frecuenciaPadres.toLowerCase()}es para padres ya fueron enviados`
            : !correspondePadres
              ? "Hoy no corresponde el día configurado"
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
      { status: 500 }
    );
  }
}