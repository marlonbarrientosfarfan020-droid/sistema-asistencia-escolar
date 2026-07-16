import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/telegram";
import { exigirAdminDirectivoDemoOPersonal } from "@/lib/auth";
import { esCronAutorizado } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZONA_HORARIA = "America/Lima";

type FrecuenciaReporte = "SEMANAL" | "MENSUAL";

type EventoCalendario = {
  fechaInicio: Date;
  fechaFin: Date;
  todosLosTurnos: boolean;
  turnoId: number | null;
  tipo: string;
  descripcion: string;
};

function fechaPeruString(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function fechaBDString(fecha: Date) {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function crearFechaPeru(
  fecha: string,
  finalDia = false
) {
  return new Date(
    `${fecha}T${
      finalDia ? "23:59:59.999" : "00:00:00"
    }-05:00`
  );
}

function crearFechaBD(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function sumarDias(fecha: string, dias: number) {
  const base = new Date(
    `${fecha}T12:00:00-05:00`
  );

  base.setDate(base.getDate() + dias);

  return fechaPeruString(base);
}

function generarFechasPeriodo(
  fechaInicio: string,
  fechaFin: string
) {
  const fechas: string[] = [];

  let actual = fechaInicio;

  while (actual <= fechaFin) {
    fechas.push(actual);
    actual = sumarDias(actual, 1);
  }

  return fechas;
}

function esFinDeSemana(fecha: string) {
  const valor = new Date(
    `${fecha}T12:00:00-05:00`
  );

  const dia = valor.getDay();

  return dia === 0 || dia === 6;
}

function obtenerPeriodo(
  frecuencia: FrecuenciaReporte
) {
  const hoy = fechaPeruString(new Date());

  const fechaActual = new Date(
    `${hoy}T12:00:00-05:00`
  );

  let fechaInicio = hoy;

  if (frecuencia === "MENSUAL") {
    fechaInicio = `${hoy.slice(0, 7)}-01`;
  } else {
    const diaActual = fechaActual.getDay();

    const diasDesdeLunes =
      diaActual === 0
        ? 6
        : diaActual - 1;

    fechaActual.setDate(
      fechaActual.getDate() - diasDesdeLunes
    );

    fechaInicio = fechaPeruString(fechaActual);
  }

  return {
    fechaInicio,
    fechaFin: hoy,

    inicioAsistencias:
      crearFechaPeru(fechaInicio),

    finAsistencias:
      crearFechaPeru(hoy, true),

    inicioCalendario:
      crearFechaBD(fechaInicio),

    finCalendario:
      crearFechaBD(hoy),
  };
}

function existeEventoNoLectivo(
  fecha: string,
  turnoId: number | null,
  eventos: EventoCalendario[]
) {
  return eventos.some((evento) => {
    const inicio = fechaBDString(
      evento.fechaInicio
    );

    const fin = fechaBDString(
      evento.fechaFin
    );

    const aplicaFecha =
      fecha >= inicio &&
      fecha <= fin;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos &&
        evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
}

function formatoFechaPeru(fecha: string) {
  const [anio, mes, dia] =
    fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}

function nombreNivelRiesgo(nivel: string) {
  const valor = nivel.toUpperCase();

  if (valor === "ALTO") {
    return "🔴 ALTO";
  }

  if (valor === "MEDIO") {
    return "🟠 MEDIO";
  }

  return "🟢 BAJO";
}

function obtenerEstadoGeneral(
  porcentajeAsistencia: number,
  tardanzas: number,
  ausencias: number
) {
  if (
    porcentajeAsistencia >= 90 &&
    tardanzas <= 1 &&
    ausencias === 0
  ) {
    return "Excelente";
  }

  if (
    porcentajeAsistencia >= 75 &&
    ausencias <= 1
  ) {
    return "Regular";
  }

  return "Requiere seguimiento";
}

function nombreFrecuencia(
  frecuencia: FrecuenciaReporte
) {
  return frecuencia === "MENSUAL"
    ? "mensual"
    : "semanal";
}

function tipoReporte(
  frecuencia: FrecuenciaReporte
) {
  return frecuencia === "MENSUAL"
    ? "PADRE_MENSUAL"
    : "PADRE_SEMANAL";
}

export async function POST(request: Request) {
 const accesoCron = esCronAutorizado(request);

if (!accesoCron) {
 const acceso =
  await exigirAdminDirectivoDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }
}

  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const forzarEnvio =
      body.forzarEnvio === true;

    const configuracion =
      await prisma.configuracion.findFirst();

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No existe configuración institucional",
        },
        { status: 404 }
      );
    }

    const frecuenciaSolicitada =
      String(
        body.frecuencia || ""
      ).toUpperCase();

    const frecuencia: FrecuenciaReporte =
      frecuenciaSolicitada === "MENSUAL"
        ? "MENSUAL"
        : frecuenciaSolicitada === "SEMANAL"
        ? "SEMANAL"
        : configuracion.frecuenciaReportePadres ===
          "MENSUAL"
        ? "MENSUAL"
        : "SEMANAL";

    const nombrePeriodo =
      nombreFrecuencia(frecuencia);

    const tipo =
      tipoReporte(frecuencia);

    if (
      !forzarEnvio &&
      !configuracion.reportePadresActivo
    ) {
      return NextResponse.json({
        ok: false,
        message:
          "Los reportes automáticos para padres están desactivados",
      });
    }

    const periodo =
      obtenerPeriodo(frecuencia);

    const eventosCalendario =
      await prisma.calendarioEscolar.findMany({
        where: {
          estado: true,

          fechaInicio: {
            lte:
              periodo.finCalendario,
          },

          fechaFin: {
            gte:
              periodo.inicioCalendario,
          },
        },

        select: {
          fechaInicio: true,
          fechaFin: true,
          todosLosTurnos: true,
          turnoId: true,
          tipo: true,
          descripcion: true,
        },
      });

    const estudiantes =
      await prisma.estudiante.findMany({
        where: {
          estado: true,
        },

        include: {
          turno: true,
          riesgoIA: true,

          asistencias: {
            where: {
              fecha: {
                gte:
                  periodo.inicioAsistencias,

                lte:
                  periodo.finAsistencias,
              },
            },

            orderBy: {
              fecha: "asc",
            },
          },
        },

        orderBy: [
          {
            apellidos: "asc",
          },
          {
            nombres: "asc",
          },
        ],
      });

    const fechasPeriodo =
      generarFechasPeriodo(
        periodo.fechaInicio,
        periodo.fechaFin
      );

    let enviados = 0;
    let omitidos = 0;
    let errores = 0;
    let sinTelegram = 0;

    const detalleProceso: Array<{
      estudiante: string;
      estado: string;
      detalle: string;
    }> = [];

    for (const estudiante of estudiantes) {
      const nombreCompleto =
        `${estudiante.nombres} ${estudiante.apellidos}`.trim();

      if (
        !estudiante.telegramChatId.trim()
      ) {
        sinTelegram++;
        omitidos++;

        await prisma.historialReporteAutomatico.create(
          {
            data: {
              tipo,

              destinatario:
                estudiante.nombreTutor ||
                "Tutor no registrado",

              chatId: "",

              estudianteId:
                estudiante.id,

              fechaInicio:
                periodo.inicioAsistencias,

              fechaFin:
                periodo.finAsistencias,

              estado:
                "SIN_TELEGRAM",

              detalle:
                `No se envió el reporte ${nombrePeriodo} de ${nombreCompleto} porque no tiene Telegram Chat ID.`,
            },
          }
        );

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "SIN_TELEGRAM",
          detalle:
            "El tutor no tiene Telegram Chat ID registrado",
        });

        continue;
      }

      if (!estudiante.turno) {
        omitidos++;

        await prisma.historialReporteAutomatico.create(
          {
            data: {
              tipo,

              destinatario:
                estudiante.nombreTutor ||
                "Tutor no registrado",

              chatId:
                estudiante.telegramChatId,

              estudianteId:
                estudiante.id,

              fechaInicio:
                periodo.inicioAsistencias,

              fechaFin:
                periodo.finAsistencias,

              estado:
                "OMITIDO",

              detalle:
                `No se generó el reporte ${nombrePeriodo} de ${nombreCompleto} porque no tiene turno asignado.`,
            },
          }
        );

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "OMITIDO",
          detalle:
            "El estudiante no tiene turno asignado",
        });

        continue;
      }

      const reporteExistente =
        await prisma.historialReporteAutomatico.findFirst(
          {
            where: {
              tipo,

              estudianteId:
                estudiante.id,

              fechaInicio:
                periodo.inicioAsistencias,

              fechaFin:
                periodo.finAsistencias,

              estado:
                "ENVIADO",
            },
          }
        );

      if (
        reporteExistente &&
        !forzarEnvio
      ) {
        omitidos++;

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "OMITIDO",
          detalle:
            `El reporte ${nombrePeriodo} ya fue enviado`,
        });

        continue;
      }

      const fechasLectivas =
        fechasPeriodo.filter((fecha) => {
          if (esFinDeSemana(fecha)) {
            return false;
          }

          return !existeEventoNoLectivo(
            fecha,
            estudiante.turnoId,
            eventosCalendario
          );
        });

      const conjuntoFechasLectivas =
        new Set(fechasLectivas);

      const asistenciasLectivas =
        estudiante.asistencias.filter(
          (asistencia) =>
            conjuntoFechasLectivas.has(
              fechaPeruString(
                asistencia.fecha
              )
            )
        );

      const fechasConAsistencia =
        new Set(
          asistenciasLectivas.map(
            (asistencia) =>
              fechaPeruString(
                asistencia.fecha
              )
          )
        );

      const diasLectivosEsperados =
        fechasLectivas.length;

      const presentes =
        fechasConAsistencia.size;

      const ausencias =
        Math.max(
          diasLectivosEsperados -
            presentes,
          0
        );

      const puntuales =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.estado ===
            "PUNTUAL"
        ).length;

      const tardanzas =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.estado ===
            "TARDE"
        ).length;

      const sinSalida =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.horaEntrada !==
              null &&
            asistencia.horaSalida ===
              null
        ).length;

      const porcentajeAsistencia =
        diasLectivosEsperados > 0
          ? Math.round(
              (presentes /
                diasLectivosEsperados) *
                100
            )
          : 0;

      const fechasAusencia =
        fechasLectivas.filter(
          (fecha) =>
            !fechasConAsistencia.has(
              fecha
            )
        );

      const eventosAplicables =
        eventosCalendario
          .filter(
            (evento) =>
              evento.todosLosTurnos ||
              evento.turnoId ===
                estudiante.turnoId
          )
          .map((evento) => ({
            descripcion:
              evento.descripcion,

            desde:
              fechaBDString(
                evento.fechaInicio
              ),

            hasta:
              fechaBDString(
                evento.fechaFin
              ),
          }));

      const estadoGeneral =
        obtenerEstadoGeneral(
          porcentajeAsistencia,
          tardanzas,
          ausencias
        );

      let bloqueRiesgoIA = "";

      if (
        configuracion
          .incluirRiesgoIAReportePadres
      ) {
        if (estudiante.riesgoIA) {
          bloqueRiesgoIA = `

🧠 ANÁLISIS PREVENTIVO

Nivel de riesgo:
${nombreNivelRiesgo(
  estudiante.riesgoIA.nivel
)} (${estudiante.riesgoIA.porcentaje}%)

📋 Resumen:
${estudiante.riesgoIA.resumen}

✅ Recomendación:
${estudiante.riesgoIA.recomendacion}`;
        } else {
          bloqueRiesgoIA = `

🧠 ANÁLISIS PREVENTIVO

El estudiante todavía no cuenta con un análisis de riesgo IA actualizado.`;
        }
      }

      const textoAusencias =
        fechasAusencia.length > 0
          ? fechasAusencia
              .map(formatoFechaPeru)
              .join(", ")
          : "Ninguna";

      const textoDiasNoLectivos =
        eventosAplicables.length > 0
          ? eventosAplicables
              .map((evento) => {
                const rango =
                  evento.desde ===
                  evento.hasta
                    ? formatoFechaPeru(
                        evento.desde
                      )
                    : `${formatoFechaPeru(
                        evento.desde
                      )} al ${formatoFechaPeru(
                        evento.hasta
                      )}`;

                return `${evento.descripcion} (${rango})`;
              })
              .join("; ")
          : "Ninguno";

      const mensaje = `📊 REPORTE ${nombrePeriodo.toUpperCase()} DE ASISTENCIA

🏫 ${configuracion.nombreColegio}

Estimado(a) ${
        estudiante.nombreTutor ||
        "padre/madre de familia"
      }:

Se presenta el resumen ${nombrePeriodo} del estudiante:

👨‍🎓 ${nombreCompleto}
🪪 DNI: ${estudiante.dni}
📚 Grado: ${estudiante.grado} - ${estudiante.seccion}
⏰ Turno: ${estudiante.turno.nombre}

📅 PERIODO:
${formatoFechaPeru(
  periodo.fechaInicio
)} al ${formatoFechaPeru(
        periodo.fechaFin
      )}

📌 RESUMEN ${nombrePeriodo.toUpperCase()}

Días lectivos: ${diasLectivosEsperados}
✅ Asistencias: ${presentes}
❌ Ausencias: ${ausencias}
🟢 Puntuales: ${puntuales}
🟠 Tardanzas: ${tardanzas}
🔵 Sin salida: ${sinSalida}
📈 Porcentaje de asistencia: ${porcentajeAsistencia}%

Estado del periodo:
${estadoGeneral}

📅 Fechas de ausencia:
${textoAusencias}

🏖️ Días no lectivos excluidos:
${textoDiasNoLectivos}
${bloqueRiesgoIA}

Este reporte tiene carácter preventivo. Ante cualquier duda, comuníquese con la institución educativa.`;

      try {
        const enviado =
          await enviarTelegram(
            estudiante.telegramChatId,
            mensaje
          );

        if (!enviado) {
          throw new Error(
            "Telegram no confirmó el envío del mensaje"
          );
        }

        enviados++;

        await prisma.historialReporteAutomatico.create(
          {
            data: {
              tipo,

              destinatario:
                estudiante.nombreTutor ||
                "Tutor no registrado",

              chatId:
                estudiante.telegramChatId,

              estudianteId:
                estudiante.id,

              fechaInicio:
                periodo.inicioAsistencias,

              fechaFin:
                periodo.finAsistencias,

              estado:
                "ENVIADO",

              detalle:
                `Reporte ${nombrePeriodo} enviado para ${nombreCompleto}. Asistencia: ${porcentajeAsistencia}%.`,
            },
          }
        );

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "ENVIADO",
          detalle:
            `Reporte ${nombrePeriodo} enviado. Asistencia: ${porcentajeAsistencia}%`,
        });
      } catch (error) {
        errores++;

        const mensajeError =
          error instanceof Error
            ? error.message
            : "Error desconocido al enviar por Telegram";

        await prisma.historialReporteAutomatico.create(
          {
            data: {
              tipo,

              destinatario:
                estudiante.nombreTutor ||
                "Tutor no registrado",

              chatId:
                estudiante.telegramChatId,

              estudianteId:
                estudiante.id,

              fechaInicio:
                periodo.inicioAsistencias,

              fechaFin:
                periodo.finAsistencias,

              estado:
                "ERROR",

              detalle:
                `Error enviando el reporte ${nombrePeriodo} de ${nombreCompleto}: ${mensajeError}`,
            },
          }
        );

        detalleProceso.push({
          estudiante:
            nombreCompleto,

          estado:
            "ERROR",

          detalle:
            mensajeError,
        });
      }
    }

    if (enviados > 0) {
      await prisma.configuracion.update({
        where: {
          id: configuracion.id,
        },

        data: {
          ultimoReportePadresAt:
            new Date(),
        },
      });
    }

    return NextResponse.json({
    ok: true,

      message:
        `Proceso de reportes ${nombrePeriodo}es para padres finalizado`,

      frecuencia,

      periodo: {
        desde:
          periodo.fechaInicio,

        hasta:
          periodo.fechaFin,
      },

      totalEstudiantes:
        estudiantes.length,

      errores,
enviados,
omitidos,

      detalle:
        detalleProceso,
    });
  } catch (error: unknown) {
    console.error(
      "Error generando reportes para padres:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error interno al generar reportes para padres";

    return NextResponse.json(
      {
        ok: false,
        message: mensaje,
      },
      {
        status: 500,
      }
    );
  }
}