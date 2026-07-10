import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/telegram";
import { exigirAdmin } from "@/lib/auth";
import { esCronAutorizado } from "@/lib/cronAuth";

export const runtime = "nodejs";

const ZONA_HORARIA = "America/Lima";
const TIPO_REPORTE = "PADRE_SEMANAL";

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

function crearFechaPeru(fecha: string, finalDia = false) {
  return new Date(
    `${fecha}T${finalDia ? "23:59:59.999" : "00:00:00"}-05:00`
  );
}

function crearFechaBD(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function sumarDias(fecha: string, dias: number) {
  const base = new Date(`${fecha}T12:00:00-05:00`);
  base.setDate(base.getDate() + dias);

  return fechaPeruString(base);
}

function numeroDiaSemanaPeru(fecha: Date) {
  const nombreDia = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
  }).format(fecha);

  const equivalencias: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return equivalencias[nombreDia] || 1;
}

function obtenerPeriodoSemanaActual() {
  const hoy = fechaPeruString(new Date());
  const diaSemana = numeroDiaSemanaPeru(new Date());

  const fechaInicio = sumarDias(hoy, -(diaSemana - 1));
  const fechaFin = hoy;

  return {
    fechaInicio,
    fechaFin,
    inicioAsistencias: crearFechaPeru(fechaInicio),
    finAsistencias: crearFechaPeru(fechaFin, true),
    inicioCalendario: crearFechaBD(fechaInicio),
    finCalendario: crearFechaBD(fechaFin),
  };
}

function generarFechasPeriodo(fechaInicio: string, fechaFin: string) {
  const fechas: string[] = [];
  let actual = fechaInicio;

  while (actual <= fechaFin) {
    fechas.push(actual);
    actual = sumarDias(actual, 1);
  }

  return fechas;
}

function esFinDeSemana(fecha: string) {
  const valor = new Date(`${fecha}T12:00:00-05:00`);
  const dia = valor.getDay();

  return dia === 0 || dia === 6;
}

function existeEventoNoLectivo(
  fecha: string,
  turnoId: number | null,
  eventos: EventoCalendario[]
) {
  return eventos.some((evento) => {
    const inicio = fechaBDString(evento.fechaInicio);
    const fin = fechaBDString(evento.fechaFin);

    const aplicaFecha = fecha >= inicio && fecha <= fin;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos && evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
}

function formatoFechaPeru(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function nombreNivelRiesgo(nivel: string) {
  const valor = nivel.toUpperCase();

  if (valor === "ALTO") return "🔴 ALTO";
  if (valor === "MEDIO") return "🟠 MEDIO";
  return "🟢 BAJO";
}

function obtenerEstadoGeneral(
  porcentajeAsistencia: number,
  tardanzas: number,
  ausencias: number
) {
  if (porcentajeAsistencia >= 90 && tardanzas <= 1 && ausencias === 0) {
    return "Excelente";
  }

  if (porcentajeAsistencia >= 75 && ausencias <= 1) {
    return "Regular";
  }

  return "Requiere seguimiento";
}

export async function POST(request: Request) {
  const accesoCron = esCronAutorizado(request);

  if (!accesoCron) {
    const acceso = await exigirAdmin();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const forzarEnvio = body.forzarEnvio === true;

    const configuracion = await prisma.configuracion.findFirst();

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          message: "No existe configuración institucional",
        },
        { status: 404 }
      );
    }

    if (!forzarEnvio && !configuracion.reportePadresActivo) {
      return NextResponse.json({
        ok: false,
        message: "Los reportes semanales para padres están desactivados",
      });
    }

    const periodo = obtenerPeriodoSemanaActual();

    const eventosCalendario =
      await prisma.calendarioEscolar.findMany({
        where: {
          estado: true,
          fechaInicio: {
            lte: periodo.finCalendario,
          },
          fechaFin: {
            gte: periodo.inicioCalendario,
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

    const estudiantes = await prisma.estudiante.findMany({
      where: {
        estado: true,
      },
      include: {
        turno: true,
        riesgoIA: true,
        asistencias: {
          where: {
            fecha: {
              gte: periodo.inicioAsistencias,
              lte: periodo.finAsistencias,
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

    const fechasSemana = generarFechasPeriodo(
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

      if (!estudiante.telegramChatId.trim()) {
        sinTelegram++;
        omitidos++;

        await prisma.historialReporteAutomatico.create({
          data: {
            tipo: TIPO_REPORTE,
            destinatario:
              estudiante.nombreTutor || "Tutor no registrado",
            chatId: "",
            estudianteId: estudiante.id,
            fechaInicio: periodo.inicioAsistencias,
            fechaFin: periodo.finAsistencias,
            estado: "SIN_TELEGRAM",
            detalle: `No se envió el reporte de ${nombreCompleto} porque no tiene Telegram Chat ID.`,
          },
        });

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "SIN_TELEGRAM",
          detalle: "El tutor no tiene Telegram Chat ID registrado",
        });

        continue;
      }

      if (!estudiante.turno) {
        omitidos++;

        await prisma.historialReporteAutomatico.create({
          data: {
            tipo: TIPO_REPORTE,
            destinatario:
              estudiante.nombreTutor || "Tutor no registrado",
            chatId: estudiante.telegramChatId,
            estudianteId: estudiante.id,
            fechaInicio: periodo.inicioAsistencias,
            fechaFin: periodo.finAsistencias,
            estado: "OMITIDO",
            detalle: `No se generó el reporte de ${nombreCompleto} porque no tiene turno asignado.`,
          },
        });

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "OMITIDO",
          detalle: "El estudiante no tiene turno asignado",
        });

        continue;
      }

      const reporteExistente =
        await prisma.historialReporteAutomatico.findFirst({
          where: {
            tipo: TIPO_REPORTE,
            estudianteId: estudiante.id,
            fechaInicio: periodo.inicioAsistencias,
            fechaFin: periodo.finAsistencias,
            estado: "ENVIADO",
          },
        });

      if (reporteExistente && !forzarEnvio) {
        omitidos++;

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "OMITIDO",
          detalle: "El reporte de esta semana ya fue enviado",
        });

        continue;
      }

      const fechasLectivas = fechasSemana.filter((fecha) => {
        if (esFinDeSemana(fecha)) {
          return false;
        }

        return !existeEventoNoLectivo(
          fecha,
          estudiante.turnoId,
          eventosCalendario
        );
      });

      const conjuntoFechasLectivas = new Set(fechasLectivas);

      const asistenciasLectivas = estudiante.asistencias.filter(
        (asistencia) =>
          conjuntoFechasLectivas.has(
            fechaPeruString(asistencia.fecha)
          )
      );

      const fechasConAsistencia = new Set(
        asistenciasLectivas.map((asistencia) =>
          fechaPeruString(asistencia.fecha)
        )
      );

      const diasLectivosEsperados = fechasLectivas.length;
      const presentes = fechasConAsistencia.size;

      const ausencias = Math.max(
        diasLectivosEsperados - presentes,
        0
      );

      const puntuales = asistenciasLectivas.filter(
        (asistencia) => asistencia.estado === "PUNTUAL"
      ).length;

      const tardanzas = asistenciasLectivas.filter(
        (asistencia) => asistencia.estado === "TARDE"
      ).length;

      const sinSalida = asistenciasLectivas.filter(
        (asistencia) =>
          asistencia.horaEntrada !== null &&
          asistencia.horaSalida === null
      ).length;

      const porcentajeAsistencia =
        diasLectivosEsperados > 0
          ? Math.round(
              (presentes / diasLectivosEsperados) * 100
            )
          : 0;

      const fechasAusencia = fechasLectivas.filter(
        (fecha) => !fechasConAsistencia.has(fecha)
      );

      const eventosAplicables = eventosCalendario
        .filter((evento) => {
          return (
            evento.todosLosTurnos ||
            evento.turnoId === estudiante.turnoId
          );
        })
        .map((evento) => ({
          tipo: evento.tipo,
          descripcion: evento.descripcion,
          desde: fechaBDString(evento.fechaInicio),
          hasta: fechaBDString(evento.fechaFin),
        }));

      const estadoGeneral = obtenerEstadoGeneral(
        porcentajeAsistencia,
        tardanzas,
        ausencias
      );

      let bloqueRiesgoIA = "";

      if (configuracion.incluirRiesgoIAReportePadres) {
        if (estudiante.riesgoIA) {
          bloqueRiesgoIA = `

🧠 ANÁLISIS PREVENTIVO

Nivel de riesgo:
${nombreNivelRiesgo(estudiante.riesgoIA.nivel)} (${estudiante.riesgoIA.porcentaje}%)

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
          ? fechasAusencia.map(formatoFechaPeru).join(", ")
          : "Ninguna";

      const textoDiasNoLectivos =
        eventosAplicables.length > 0
          ? eventosAplicables
              .map(
                (evento) =>
                  `${evento.descripcion} (${formatoFechaPeru(
                    evento.desde
                  )}${
                    evento.desde !== evento.hasta
                      ? ` al ${formatoFechaPeru(evento.hasta)}`
                      : ""
                  })`
              )
              .join("; ")
          : "Ninguno";

      const mensaje = `📊 REPORTE SEMANAL DE ASISTENCIA

🏫 ${configuracion.nombreColegio}

Estimado(a) ${
        estudiante.nombreTutor || "padre/madre de familia"
      }:

Se presenta el resumen semanal del estudiante:

👨‍🎓 ${nombreCompleto}
🪪 DNI: ${estudiante.dni}
📚 Grado: ${estudiante.grado} - ${estudiante.seccion}
⏰ Turno: ${estudiante.turno.nombre}

📅 Periodo:
${formatoFechaPeru(periodo.fechaInicio)} al ${formatoFechaPeru(
        periodo.fechaFin
      )}

📌 RESUMEN

Días lectivos: ${diasLectivosEsperados}
✅ Asistencias: ${presentes}
❌ Ausencias: ${ausencias}
🟢 Puntuales: ${puntuales}
🟠 Tardanzas: ${tardanzas}
🔵 Sin salida: ${sinSalida}
📈 Porcentaje de asistencia: ${porcentajeAsistencia}%

Estado semanal:
${estadoGeneral}

📅 Fechas de ausencia:
${textoAusencias}

🏖️ Días no lectivos excluidos:
${textoDiasNoLectivos}
${bloqueRiesgoIA}

Este reporte tiene carácter preventivo. Ante cualquier duda, comuníquese con la institución educativa.`;

      try {
        const enviado = await enviarTelegram(
          estudiante.telegramChatId,
          mensaje
        );

        if (!enviado) {
          throw new Error(
            "Telegram no confirmó el envío del mensaje"
          );
        }

        enviados++;

        await prisma.historialReporteAutomatico.create({
          data: {
            tipo: TIPO_REPORTE,
            destinatario:
              estudiante.nombreTutor || "Tutor no registrado",
            chatId: estudiante.telegramChatId,
            estudianteId: estudiante.id,
            fechaInicio: periodo.inicioAsistencias,
            fechaFin: periodo.finAsistencias,
            estado: "ENVIADO",
            detalle: `Reporte semanal enviado para ${nombreCompleto}. Asistencia: ${porcentajeAsistencia}%.`,
          },
        });

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "ENVIADO",
          detalle: `Reporte enviado. Asistencia: ${porcentajeAsistencia}%`,
        });
      } catch (error) {
        errores++;

        const mensajeError =
          error instanceof Error
            ? error.message
            : "Error desconocido al enviar por Telegram";

        await prisma.historialReporteAutomatico.create({
          data: {
            tipo: TIPO_REPORTE,
            destinatario:
              estudiante.nombreTutor || "Tutor no registrado",
            chatId: estudiante.telegramChatId,
            estudianteId: estudiante.id,
            fechaInicio: periodo.inicioAsistencias,
            fechaFin: periodo.finAsistencias,
            estado: "ERROR",
            detalle: `Error enviando el reporte de ${nombreCompleto}: ${mensajeError}`,
          },
        });

        detalleProceso.push({
          estudiante: nombreCompleto,
          estado: "ERROR",
          detalle: mensajeError,
        });
      }
    }

    await prisma.configuracion.update({
      where: {
        id: configuracion.id,
      },
      data: {
        ultimoReportePadresAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: errores === 0,
      message: "Proceso de reportes semanales finalizado",
      periodo: {
        desde: periodo.fechaInicio,
        hasta: periodo.fechaFin,
      },
      totalEstudiantes: estudiantes.length,
      enviados,
      omitidos,
      sinTelegram,
      errores,
      detalle: detalleProceso,
    });
  } catch (error: unknown) {
    console.error(
      "Error generando reportes semanales para padres:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error interno al generar reportes semanales";

    return NextResponse.json(
      {
        ok: false,
        message: mensaje,
      },
      { status: 500 }
    );
  }
}