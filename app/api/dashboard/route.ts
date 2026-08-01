import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDirectivoODemo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONA_HORARIA = "America/Lima";

function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fechaPeruDesdeDate(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function nombreDiaCorto(fechaISO: string) {
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    timeZone: ZONA_HORARIA,
  })
    .format(new Date(`${fechaISO}T12:00:00.000-05:00`))
    .replace(".", "")
    .toUpperCase();
}

export async function GET() {
  const acceso = await exigirAdminDirectivoODemo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const hoy = fechaPeru();

    /*
     * CalendarioEscolar utiliza columnas @db.Date.
     * Se compara usando medianoche UTC.
     */
    const fechaHoyBD = new Date(
      `${hoy}T00:00:00.000Z`
    );

    /*
     * Asistencia utiliza DateTime.
     * Se consulta el día completo en la zona horaria de Perú.
     */
    const inicioDia = new Date(
      `${hoy}T00:00:00.000-05:00`
    );

    const finDia = new Date(
      `${hoy}T23:59:59.999-05:00`
    );

    const configuracion =
      await prisma.configuracion.findFirst();

    const estudiantesActivos =
      await prisma.estudiante.findMany({
        where: {
          estado: true,
        },
        select: {
          id: true,
          turnoId: true,
        },
      });

    const totalEstudiantes =
      estudiantesActivos.length;

    const eventosNoLectivosHoy =
      await prisma.calendarioEscolar.findMany({
        where: {
          estado: true,
          fechaInicio: {
            lte: fechaHoyBD,
          },
          fechaFin: {
            gte: fechaHoyBD,
          },
        },
        include: {
          turno: true,
        },
        orderBy: [
          {
            fechaInicio: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    const diaNoLectivoGeneral =
      eventosNoLectivosHoy.some(
        (evento) => evento.todosLosTurnos
      );

    function turnoNoLectivo(
      turnoId: number | null
    ) {
      return eventosNoLectivosHoy.some(
        (evento) =>
          evento.todosLosTurnos ||
          (!evento.todosLosTurnos &&
            evento.turnoId === turnoId)
      );
    }

    const estudiantesEsperadosHoy =
      estudiantesActivos.filter(
        (estudiante) =>
          !turnoNoLectivo(
            estudiante.turnoId
          )
      );

    const idsEstudiantesEsperados =
      new Set(
        estudiantesEsperadosHoy.map(
          (estudiante) => estudiante.id
        )
      );

    const asistenciasRegistradasHoy =
      await prisma.asistencia.findMany({
        where: {
          fecha: {
            gte: inicioDia,
            lte: finDia,
          },
        },
        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },
      });

    /*
     * Excluye registros accidentales de estudiantes
     * cuyos turnos fueron declarados no lectivos.
     */
    const asistenciasHoy =
      asistenciasRegistradasHoy.filter(
        (asistencia) =>
          idsEstudiantesEsperados.has(
            asistencia.estudianteId
          )
      );

    const ultimasAsistencias =
      await prisma.asistencia.findMany({
        take: 8,
        orderBy: {
          fecha: "desc",
        },
        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },
      });

    const turnos =
      await prisma.turno.findMany({
        where: {
          estado: true,
        },
        orderBy: {
          id: "asc",
        },
      });

    const ultimoAnalisisIA =
      await prisma.analisisIA.findFirst({
        orderBy: {
          createdAt: "desc",
        },
      });

    /*
     * Ranking actual de estudiantes según el riesgo
     * calculado y guardado en RiesgoEstudianteIA.
     */
    const topRiesgoIA =
      await prisma.riesgoEstudianteIA.findMany({
        take: 5,
        orderBy: [
          {
            porcentaje: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },
      });

    /*
     * Los contadores se calculan directamente desde
     * los riesgos actuales de los estudiantes.
     * Ya no se cuentan palabras dentro del análisis general.
     */
    const [
      riesgoAlto,
      riesgoMedio,
      riesgoBajo,
    ] = await Promise.all([
      prisma.riesgoEstudianteIA.count({
        where: {
          nivel: "ALTO",
        },
      }),

      prisma.riesgoEstudianteIA.count({
        where: {
          nivel: "MEDIO",
        },
      }),

      prisma.riesgoEstudianteIA.count({
        where: {
          nivel: "BAJO",
        },
      }),
    ]);

    /*
     * El último análisis general se conserva solamente
     * para mostrar el resumen inteligente.
     */
    const textoIA =
      ultimoAnalisisIA?.resultado || "";

    const resumenIA =
      textoIA.length > 0
        ? textoIA.slice(0, 450) +
          (textoIA.length > 450
            ? "..."
            : "")
        : "La IA aún no ha generado un análisis. Ingrese al Centro de Inteligencia Escolar para ejecutar un análisis general o individual.";

    const totalEsperadosHoy =
      estudiantesEsperadosHoy.length;

    const presentes =
      asistenciasHoy.length;

    const ausentes = Math.max(
      totalEsperadosHoy - presentes,
      0
    );

    const entradas =
      asistenciasHoy.filter(
        (asistencia) =>
          asistencia.horaEntrada !== null
      ).length;

    const salidas =
      asistenciasHoy.filter(
        (asistencia) =>
          asistencia.horaSalida !== null
      ).length;

    const sinSalida =
      asistenciasHoy.filter(
        (asistencia) =>
          asistencia.horaEntrada !== null &&
          asistencia.horaSalida === null
      ).length;

    const puntuales =
      asistenciasHoy.filter(
        (asistencia) =>
          asistencia.estado === "PUNTUAL"
      ).length;

    const tardanzas =
      asistenciasHoy.filter(
        (asistencia) =>
          asistencia.estado === "TARDE"
      ).length;

    const resumenTurnos =
      await Promise.all(
        turnos.map(async (turno) => {
          const total =
            await prisma.estudiante.count({
              where: {
                estado: true,
                turnoId: turno.id,
              },
            });

          const eventoNoLectivo =
            eventosNoLectivosHoy.find(
              (evento) =>
                evento.todosLosTurnos ||
                (!evento.todosLosTurnos &&
                  evento.turnoId ===
                    turno.id)
            );

          const asistenciasTurno =
            eventoNoLectivo
              ? []
              : asistenciasHoy.filter(
                  (asistencia) =>
                    asistencia.estudiante
                      .turnoId === turno.id
                );

          return {
            id: turno.id,
            nombre: turno.nombre,
            horaEntrada:
              turno.horaEntrada,
            horaSalida:
              turno.horaSalida,
            total,

            noLectivo:
              Boolean(eventoNoLectivo),

            motivoNoLectivo:
              eventoNoLectivo
                ?.descripcion || "",

            presentes:
              asistenciasTurno.length,

            ausentes: eventoNoLectivo
              ? 0
              : Math.max(
                  total -
                    asistenciasTurno.length,
                  0
                ),

            puntuales:
              asistenciasTurno.filter(
                (asistencia) =>
                  asistencia.estado ===
                  "PUNTUAL"
              ).length,

            tardanzas:
              asistenciasTurno.filter(
                (asistencia) =>
                  asistencia.estado ===
                  "TARDE"
              ).length,

            sinSalida:
              asistenciasTurno.filter(
                (asistencia) =>
                  asistencia.horaEntrada !==
                    null &&
                  asistencia.horaSalida ===
                    null
              ).length,
          };
        })
      );

    /*
     * Tendencia de los últimos 7 días para los gráficos tipo Power BI.
     */
    const fechaInicioTendencia = new Date(inicioDia);
    fechaInicioTendencia.setDate(fechaInicioTendencia.getDate() - 6);

    const asistenciasUltimos7Dias =
      await prisma.asistencia.findMany({
        where: {
          fecha: {
            gte: fechaInicioTendencia,
            lte: finDia,
          },
        },
        select: {
          fecha: true,
          estado: true,
          estudianteId: true,
          estudiante: {
            select: {
              turnoId: true,
            },
          },
        },
      });

    const fechaInicioCalendario = new Date(
      `${fechaPeruDesdeDate(fechaInicioTendencia)}T00:00:00.000Z`
    );

    const eventosUltimos7Dias =
      await prisma.calendarioEscolar.findMany({
        where: {
          estado: true,
          fechaInicio: {
            lte: fechaHoyBD,
          },
          fechaFin: {
            gte: fechaInicioCalendario,
          },
        },
        select: {
          fechaInicio: true,
          fechaFin: true,
          todosLosTurnos: true,
          turnoId: true,
        },
      });

    const tendenciaSemanal = Array.from(
      { length: 7 },
      (_, indice) => {
        const fecha = new Date(fechaInicioTendencia);
        fecha.setDate(fechaInicioTendencia.getDate() + indice);

        const fechaISO = fechaPeruDesdeDate(fecha);
        const fechaComparacion = new Date(
          `${fechaISO}T00:00:00.000Z`
        );

        const eventosDelDia =
          eventosUltimos7Dias.filter(
            (evento) =>
              evento.fechaInicio <= fechaComparacion &&
              evento.fechaFin >= fechaComparacion
          );

        const esperado = estudiantesActivos.filter(
          (estudiante) =>
            !eventosDelDia.some(
              (evento) =>
                evento.todosLosTurnos ||
                evento.turnoId === estudiante.turnoId
            )
        );

        const idsEsperados = new Set(
          esperado.map((estudiante) => estudiante.id)
        );

        const registros = asistenciasUltimos7Dias.filter(
          (asistencia) =>
            fechaPeruDesdeDate(asistencia.fecha) === fechaISO &&
            idsEsperados.has(asistencia.estudianteId)
        );

        const presentesDia = new Set(
          registros.map((asistencia) => asistencia.estudianteId)
        ).size;

        const puntualesDia = registros.filter(
          (asistencia) => asistencia.estado === "PUNTUAL"
        ).length;

        const tardanzasDia = registros.filter(
          (asistencia) => asistencia.estado === "TARDE"
        ).length;

        const totalDia = esperado.length;
        const ausentesDia = Math.max(totalDia - presentesDia, 0);

        return {
          fecha: fechaISO,
          dia: nombreDiaCorto(fechaISO),
          total: totalDia,
          presentes: presentesDia,
          ausentes: ausentesDia,
          puntuales: puntualesDia,
          tardanzas: tardanzasDia,
          porcentaje:
            totalDia > 0
              ? Math.round((presentesDia / totalDia) * 100)
              : 0,
        };
      }
    );

    return NextResponse.json({
      totalEstudiantes,
      totalEsperadosHoy,
      presentes,
      ausentes,
      entradas,
      salidas,
      puntuales,
      tardanzas,
      sinSalida,

      diaNoLectivo:
        eventosNoLectivosHoy.length > 0,

      diaNoLectivoGeneral,

      eventosNoLectivosHoy:
        eventosNoLectivosHoy.map(
          (evento) => ({
            id: evento.id,
            tipo: evento.tipo,
            descripcion:
              evento.descripcion,
            fechaInicio:
              evento.fechaInicio,
            fechaFin:
              evento.fechaFin,
            todosLosTurnos:
              evento.todosLosTurnos,
            turnoId:
              evento.turnoId,
            turno:
              evento.turno?.nombre ||
              null,
          })
        ),

      horaReporteDiario:
        configuracion
          ?.horaReporteDiario ||
        "21:00",

      ultimoReporteTelegramAt:
        configuracion
          ?.ultimoReporteTelegramAt ||
        null,

      ultimoReporteTelegramEstado:
        configuracion
          ?.ultimoReporteTelegramEstado ||
        "",

      resumenTurnos,
      ultimasAsistencias,

      riesgoAlto,
      riesgoMedio,
      riesgoBajo,
      resumenIA,
      topRiesgoIA,
      tendenciaSemanal,
    });
  } catch (error) {
    console.error(
      "Error obteniendo dashboard:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al obtener estadísticas",
      },
      {
        status: 500,
      }
    );
  }
}