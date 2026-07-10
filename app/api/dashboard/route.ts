import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ZONA_HORARIA = "America/Lima";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json(
    { message: "No autorizado" },
    { status: 401 }
  );
}

function contarRiesgo(texto: string, palabra: string) {
  const regex = new RegExp(palabra, "gi");
  return (texto.match(regex) || []).length;
}

function fechaPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) {
    return noAutorizado();
  }

  try {
    const hoy = fechaPeru();

    /*
     * Para CalendarioEscolar, cuyas columnas son @db.Date.
     * Se compara usando medianoche UTC para evitar que un evento
     * del día anterior aparezca todavía activo en Perú.
     */
    const fechaHoyBD = new Date(`${hoy}T00:00:00.000Z`);

    /*
     * Para Asistencia, que usa DateTime.
     * Se consulta el día completo en la zona horaria de Perú.
     */
    const inicioDia = new Date(`${hoy}T00:00:00.000-05:00`);
    const finDia = new Date(`${hoy}T23:59:59.999-05:00`);

    const configuracion = await prisma.configuracion.findFirst();

    const estudiantesActivos = await prisma.estudiante.findMany({
      where: {
        estado: true,
      },
      select: {
        id: true,
        turnoId: true,
      },
    });

    const totalEstudiantes = estudiantesActivos.length;

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

    const diaNoLectivoGeneral = eventosNoLectivosHoy.some(
      (evento) => evento.todosLosTurnos
    );

    function turnoNoLectivo(turnoId: number | null) {
      return eventosNoLectivosHoy.some(
        (evento) =>
          evento.todosLosTurnos ||
          (!evento.todosLosTurnos &&
            evento.turnoId === turnoId)
      );
    }

    const estudiantesEsperadosHoy = estudiantesActivos.filter(
      (estudiante) => !turnoNoLectivo(estudiante.turnoId)
    );

    const idsEstudiantesEsperados = new Set(
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
     * Excluye registros accidentales de estudiantes cuyos turnos
     * fueron declarados no lectivos.
     */
    const asistenciasHoy = asistenciasRegistradasHoy.filter(
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

    const turnos = await prisma.turno.findMany({
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

    const topRiesgoIA =
      await prisma.riesgoEstudianteIA.findMany({
        take: 5,
        orderBy: {
          porcentaje: "desc",
        },
        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },
      });

    const textoIA = ultimoAnalisisIA?.resultado || "";

    const riesgoAlto = contarRiesgo(
      textoIA,
      "riesgo alto"
    );

    const riesgoMedio = contarRiesgo(
      textoIA,
      "riesgo medio"
    );

    const riesgoBajo = contarRiesgo(
      textoIA,
      "riesgo bajo"
    );

    const resumenIA =
      textoIA.length > 0
        ? textoIA.slice(0, 450) +
          (textoIA.length > 450 ? "..." : "")
        : "La IA aún no ha generado un análisis. Ingrese al Centro de Inteligencia Escolar para ejecutar un análisis general o individual.";

    const totalEsperadosHoy =
      estudiantesEsperadosHoy.length;

    const presentes = asistenciasHoy.length;

    const ausentes = Math.max(
      totalEsperadosHoy - presentes,
      0
    );

    const entradas = asistenciasHoy.filter(
      (asistencia) =>
        asistencia.horaEntrada !== null
    ).length;

    const salidas = asistenciasHoy.filter(
      (asistencia) =>
        asistencia.horaSalida !== null
    ).length;

    const sinSalida = asistenciasHoy.filter(
      (asistencia) =>
        asistencia.horaEntrada !== null &&
        asistencia.horaSalida === null
    ).length;

    const puntuales = asistenciasHoy.filter(
      (asistencia) =>
        asistencia.estado === "PUNTUAL"
    ).length;

    const tardanzas = asistenciasHoy.filter(
      (asistencia) =>
        asistencia.estado === "TARDE"
    ).length;

    const resumenTurnos = await Promise.all(
      turnos.map(async (turno) => {
        const total = await prisma.estudiante.count({
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
                evento.turnoId === turno.id)
          );

        const asistenciasTurno = eventoNoLectivo
          ? []
          : asistenciasHoy.filter(
              (asistencia) =>
                asistencia.estudiante.turnoId ===
                turno.id
            );

        return {
          id: turno.id,
          nombre: turno.nombre,
          horaEntrada: turno.horaEntrada,
          horaSalida: turno.horaSalida,
          total,

          noLectivo: Boolean(eventoNoLectivo),

          motivoNoLectivo:
            eventoNoLectivo?.descripcion || "",

          presentes: asistenciasTurno.length,

          ausentes: eventoNoLectivo
            ? 0
            : Math.max(
                total - asistenciasTurno.length,
                0
              ),

          puntuales: asistenciasTurno.filter(
            (asistencia) =>
              asistencia.estado === "PUNTUAL"
          ).length,

          tardanzas: asistenciasTurno.filter(
            (asistencia) =>
              asistencia.estado === "TARDE"
          ).length,

          sinSalida: asistenciasTurno.filter(
            (asistencia) =>
              asistencia.horaEntrada !== null &&
              asistencia.horaSalida === null
          ).length,
        };
      })
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
        eventosNoLectivosHoy.map((evento) => ({
          id: evento.id,
          tipo: evento.tipo,
          descripcion: evento.descripcion,
          fechaInicio: evento.fechaInicio,
          fechaFin: evento.fechaFin,
          todosLosTurnos:
            evento.todosLosTurnos,
          turnoId: evento.turnoId,
          turno: evento.turno?.nombre || null,
        })),

      horaReporteDiario:
        configuracion?.horaReporteDiario ||
        "21:00",

      ultimoReporteTelegramAt:
        configuracion?.ultimoReporteTelegramAt ||
        null,

      ultimoReporteTelegramEstado:
        configuracion?.ultimoReporteTelegramEstado ||
        "",

      resumenTurnos,
      ultimasAsistencias,

      riesgoAlto,
      riesgoMedio,
      riesgoBajo,
      resumenIA,
      topRiesgoIA,
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