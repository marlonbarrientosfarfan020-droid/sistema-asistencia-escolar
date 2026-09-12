import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  esCronAutorizado,
  respuestaCronNoAutorizado,
} from "@/lib/cronAuth";
import { exigirAdminODirectivo } from "@/lib/auth";
import { obtenerEstadoSuperMotor } from "@/lib/supermotor";
import {
  registrarAuditoriaCron,
  registrarAuditoriaBloqueo,
} from "@/lib/supermotor-guard";
import { evaluarJornadaActual } from "@/services/jornada/motorJornada";
import { registrarEventoSalud } from "@/lib/health";

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

function minutosHora(hora: string) {
  const [horas, minutos] = hora
    .split(":")
    .map(Number);

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
  if (!fechaA) {
    return false;
  }

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
  if (!fechaA) {
    return false;
  }

  return (
    obtenerMesPeru(fechaA) ===
    obtenerMesPeru(fechaB)
  );
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
  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
  const cronSecret = process.env.CRON_SECRET || "cron-internal-default-secret";

  const respuesta = await fetch(
    `${appUrl}${ruta}`,
    {
      method: metodo,
      headers: {
        Authorization:
          `Bearer ${cronSecret}`,

        ...(body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
      },

      body: body
        ? JSON.stringify(body)
        : undefined,

      cache: "no-store",
    }
  );

  const data = await respuesta
    .json()
    .catch(() => ({
      message:
        "La ruta no devolvió JSON",
    }));

  return {
    ok: respuesta.ok,
    status: respuesta.status,
    data,
  };
}

export async function GET(request: Request) {
  // Autenticación: Vercel Cron Secret O sesión de ADMIN / DIRECTIVO
  const esAutorizadoPorSecret = esCronAutorizado(request);
  let esAutorizadoPorSesion = false;

  if (!esAutorizadoPorSecret) {
    const sesion = await exigirAdminODirectivo(request);
    esAutorizadoPorSesion = sesion.autorizado;
  }

  if (!esAutorizadoPorSecret && !esAutorizadoPorSesion) {
    return respuestaCronNoAutorizado();
  }

  const inicio = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const colegioId = searchParams.get("colegioId") || "SANTA_RITA_001";

    // FASE 7.7 & FASE 8.7: Evaluar jornada escolar periódicamente por colegio
    const evaluacionJornada = await evaluarJornadaActual({ colegioId });

    // FASE 5.1 & FASE 8.3: Consultar SuperMotor del colegio antes de ejecutar cualquier automatización
    const estadoMotor = await obtenerEstadoSuperMotor(colegioId);

    // Validar si el motor principal está activo
    if (!estadoMotor.motorActivo) {
      console.log(`[CRON] SuperMotor apagado para ${colegioId}. Automatizaciones suspendidas.`);
      await registrarAuditoriaCron({
        proceso: "AUTOMATIZACIONES",
        estado: "DETENIDO",
        motor: "DETENIDO",
        jornada: estadoMotor.estadoJornada,
        detalles: `SuperMotor apagado para ${colegioId}. Automatizaciones suspendidas.`,
      });

      await registrarEventoSalud({
        servicio: "CRON",
        estado: "WARNING",
        mensaje: `SuperMotor apagado para ${colegioId}. Automatizaciones suspendidas.`,
        tiempoRespuesta: Date.now() - inicio,
        colegioId,
      });

      return NextResponse.json({
        ok: false,
        colegioId,
        estado: "detenido",
        mensaje: `SuperMotor apagado para ${colegioId}. Automatizaciones suspendidas.`,
        message: `SuperMotor apagado para ${colegioId}. Automatizaciones suspendidas.`,
        motor: "DETENIDO",
        jornada: estadoMotor.estadoJornada === "CERRADO" ? "CERRADA" : "OPERATIVA",
        procesosEjecutados: [],
        procesosOmitidos: ["alertas", "reportes", "telegram"],
      });
    }

    // FASE 5.3: Control de Jornada Escolar
    // Preparación para estados: CERRADO, APERTURA, OPERATIVO, CIERRE
    const jornadaOperativa =
      estadoMotor.estadoJornada !== "CERRADO" &&
      estadoMotor.estadoJornada !== "PAUSADO" &&
      estadoMotor.estadoJornada !== "MANTENIMIENTO";

    if (!jornadaOperativa) {
      console.log(`[CRON] Jornada escolar no operativa para ${colegioId} (${estadoMotor.estadoJornada}). Automatizaciones suspendidas.`);
      await registrarAuditoriaCron({
        proceso: "AUTOMATIZACIONES",
        estado: "DETENIDO",
        motor: "ACTIVO",
        jornada: estadoMotor.estadoJornada,
        detalles: `Jornada escolar en estado ${estadoMotor.estadoJornada} para ${colegioId}. Automatizaciones suspendidas.`,
      });

      await registrarEventoSalud({
        servicio: "CRON",
        estado: "WARNING",
        mensaje: `Jornada no operativa (${estadoMotor.estadoJornada}) para ${colegioId}. Automatizaciones omitidas.`,
        tiempoRespuesta: Date.now() - inicio,
        colegioId,
      });

      return NextResponse.json({
        ok: false,
        colegioId,
        estado: "detenido",
        mensaje: "Jornada escolar no operativa. Automatizaciones suspendidas.",
        message: "Jornada escolar no operativa. Automatizaciones suspendidas.",
        motor: "ACTIVO",
        jornada: "CERRADA",
        procesosEjecutados: [],
        procesosOmitidos: ["alertas", "reportes", "telegram"],
      });
    }

    const configuracion =
      (await prisma.configuracion.findFirst({ where: { colegioId } })) ||
      (await prisma.configuracion.findFirst());

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          colegioId,
          message:
            "No existe configuración institucional para " + colegioId,
        },
        {
          status: 404,
        }
      );
    }

    const ahora = new Date();
    const horaActual = horaPeru();
    const diaSemanaActual = diaSemanaPeru();
    const diaMesActual = diaMesPeru();

    const procesosEjecutados: string[] = [];
    const procesosOmitidos: string[] = [];

    const resultados: Record<string, unknown> = {
      fecha: fechaPeru(),
      hora: horaActual,
      diaSemana: diaSemanaActual,
      diaMes: diaMesActual,
    };

    /*
     * FASE 5.2: 1. ALERTAS DE AUSENCIA
     * Validar modulo 'alertas'
     */
    if (estadoMotor.alertasActivo) {
      procesosEjecutados.push("alertas");
      try {
        resultados.alertasAusencia =
          await ejecutarRuta(
            "/api/alertas/ausentes"
          );

        await registrarAuditoriaCron({
          proceso: "ALERTAS_ASISTENCIA",
          estado: "EJECUTADO",
          motor: "ACTIVO",
          jornada: estadoMotor.estadoJornada,
        });
      } catch (errAlertas: any) {
        console.error("[CRON] Error al ejecutar alertas:", errAlertas);
        resultados.alertasAusencia = {
          ok: false,
          message: errAlertas?.message || "Error al invocar /api/alertas/ausentes",
        };
      }
    } else {
      procesosOmitidos.push("alertas");
      resultados.alertasAusencia = {
        ejecutado: false,
        motivo: "Módulo de alertas desactivado en SuperMotor",
      };
      await registrarAuditoriaCron({
        proceso: "ALERTAS_ASISTENCIA",
        estado: "OMITIDO",
        motor: "ACTIVO",
        jornada: estadoMotor.estadoJornada,
        detalles: "alertasActivo=false",
      });
    }

    /*
     * FASE 5.2: 2. REPORTES (Director y Padres)
     * Validar modulo 'reportes'
     */
    if (estadoMotor.reportesActivo) {
      procesosEjecutados.push("reportes");
      await registrarAuditoriaCron({
        proceso: "REPORTES",
        estado: "EJECUTADO",
        motor: "ACTIVO",
        jornada: estadoMotor.estadoJornada,
      });

      // 2.A: REPORTE DEL DIRECTOR
      if (configuracion.reporteDirectorActivo) {
        const frecuenciaDirector =
          configuracion
            .frecuenciaReporteDirector ===
          "MENSUAL"
            ? "MENSUAL"
            : "SEMANAL";

        const esHoraDirector =
          minutosHora(horaActual) >=
          minutosHora(
            configuracion.horaReporteDirector
          );

        const correspondeDirector =
          correspondePeriodo({
            frecuencia: frecuenciaDirector,

            diaSemanaConfigurado:
              configuracion.diaReporteDirector,

            diaMesConfigurado:
              configuracion.diaMesReporteDirector,

            diaSemanaActual,
            diaMesActual,
          });

        const yaEnviadoDirector =
          yaFueEnviado({
            frecuencia: frecuenciaDirector,

            ultimoEnvio:
              configuracion
                .ultimoReporteDirectorAt,

            ahora,
          });

        if (
          esHoraDirector &&
          correspondeDirector &&
          !yaEnviadoDirector
        ) {
          const resultadoDirector =
            await ejecutarRuta(
              `/api/reportes/telegram-diario?frecuencia=${frecuenciaDirector}`
            );

          resultados.reporteDirector =
            resultadoDirector;

          if (resultadoDirector.ok) {
            await prisma.configuracion.update({
              where: {
                id: configuracion.id,
              },

              data: {
                ultimoReporteDirectorAt:
                  ahora,
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
          motivo:
            "Reporte del director desactivado en configuración",
        };
      }

      // 2.B: REPORTES PARA PADRES
      if (configuracion.reportePadresActivo) {
        const frecuenciaPadres =
          configuracion
            .frecuenciaReportePadres ===
          "MENSUAL"
            ? "MENSUAL"
            : "SEMANAL";

        const esHoraPadres =
          minutosHora(horaActual) >=
          minutosHora(
            configuracion.horaReportePadres
          );

        const correspondePadres =
          correspondePeriodo({
            frecuencia: frecuenciaPadres,

            diaSemanaConfigurado:
              configuracion.diaReportePadres,

            diaMesConfigurado:
              configuracion.diaMesReportePadres,

            diaSemanaActual,
            diaMesActual,
          });

        const yaEnviadoPadres =
          yaFueEnviado({
            frecuencia: frecuenciaPadres,

            ultimoEnvio:
              configuracion
                .ultimoReportePadresAt,

            ahora,
          });

        if (
          esHoraPadres &&
          correspondePadres &&
          !yaEnviadoPadres
        ) {
          const resultadoPadres =
            await ejecutarRuta(
              "/api/reportes/padres-semanal",
              "POST",
              {
                forzarEnvio: false,
                frecuencia:
                  frecuenciaPadres,
              }
            );

          resultados.reportePadres =
            resultadoPadres;
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
          motivo:
            "Reportes para padres desactivados en configuración",
        };
      }
    } else {
      procesosOmitidos.push("reportes");
      resultados.reporteDirector = {
        ejecutado: false,
        motivo: "Módulo de reportes desactivado en SuperMotor",
      };
      resultados.reportePadres = {
        ejecutado: false,
        motivo: "Módulo de reportes desactivado en SuperMotor",
      };
      await registrarAuditoriaCron({
        proceso: "REPORTES",
        estado: "OMITIDO",
        motor: "ACTIVO",
        jornada: estadoMotor.estadoJornada,
        detalles: "reportesActivo=false",
      });
    }

    /*
     * FASE 5.2: 3. TELEGRAM
     * Registrar en ejecutados u omitidos
     */
    if (estadoMotor.telegramActivo) {
      procesosEjecutados.push("telegram");
    } else {
      procesosOmitidos.push("telegram");
    }

    const duracionMs = Date.now() - inicio;

    // FASE 13.3: Registrar telemetría de éxito del Cron
    await registrarEventoSalud({
      servicio: "CRON",
      estado: "OK",
      mensaje: `Ejecutado correctamente (${procesosEjecutados.join(", ") || "sin procesos"})`,
      tiempoRespuesta: duracionMs,
      detalles: { procesosEjecutados, procesosOmitidos },
      colegioId,
    });

    // FASE 5.6: Devolver respuesta estructurada y clara
    return NextResponse.json({
      ok: true,
      motor: "ACTIVO",
      jornada: "OPERATIVA",
      procesosEjecutados,
      procesosOmitidos,
      message: "Verificación automática finalizada",
      duracionMs,
      resultados,
    });
  } catch (error) {
    console.error(
      "Error en automatizaciones:",
      error
    );

    const duracionMs = Date.now() - inicio;
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Error en el motor de automatizaciones";

    // FASE 13.3: Registrar telemetría de error del Cron
    await registrarEventoSalud({
      servicio: "CRON",
      estado: "ERROR",
      mensaje: errorMsg,
      tiempoRespuesta: duracionMs,
      colegioId: "SANTA_RITA_001",
    });

    return NextResponse.json(
      {
        ok: false,
        message: errorMsg,
        duracionMs,
      },
      {
        status: 500,
      }
    );
  }
}