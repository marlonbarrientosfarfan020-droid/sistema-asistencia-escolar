


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZONA_HORARIA = "America/Lima";
const DIAS_ANALISIS = 30;
const LIMITE_MAXIMO = 20;

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

type EventoCalendario = {
  fechaInicio: Date;
  fechaFin: Date;
  todosLosTurnos: boolean;
  turnoId: number | null;
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

function sumarDias(fecha: string, dias: number) {
  const fechaBase = new Date(`${fecha}T12:00:00-05:00`);
  fechaBase.setDate(fechaBase.getDate() + dias);
  return fechaPeruString(fechaBase);
}

function obtenerPeriodoAnalisis() {
  const hoy = fechaPeruString(new Date());
  const fechaFin = sumarDias(hoy, -1);
  const fechaInicio = sumarDias(fechaFin, -(DIAS_ANALISIS - 1));

  return {
    fechaInicio,
    fechaFin,
    inicio: crearFechaPeru(fechaInicio),
    fin: crearFechaPeru(fechaFin, true),
  };
}

function esFinDeSemana(fecha: string) {
  const fechaLocal = new Date(`${fecha}T12:00:00-05:00`);
  const diaSemana = fechaLocal.getDay();
  return diaSemana === 0 || diaSemana === 6;
}

function generarFechasPeriodo(fechaInicio: string, fechaFin: string) {
  if (fechaInicio > fechaFin) return [];

  const fechas: string[] = [];
  let fechaActual = fechaInicio;

  while (fechaActual <= fechaFin) {
    fechas.push(fechaActual);
    fechaActual = sumarDias(fechaActual, 1);
  }

  return fechas;
}

function existeEventoNoLectivo(
  fecha: string,
  turnoId: number | null,
  eventos: EventoCalendario[]
) {
  return eventos.some((evento) => {
    const inicioEvento = fechaBDString(evento.fechaInicio);
    const finEvento = fechaBDString(evento.fechaFin);

    const aplicaFecha =
      fecha >= inicioEvento && fecha <= finEvento;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos && evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
}

function limitarPorcentaje(valor: number) {
  return Math.min(100, Math.max(0, Math.round(valor)));
}

function calcularRiesgo({
  tieneTurno,
  diasLectivosEsperados,
  ausencias,
  tardanzas,
  sinSalida,
}: {
  tieneTurno: boolean;
  diasLectivosEsperados: number;
  ausencias: number;
  tardanzas: number;
  sinSalida: number;
}) {
  if (!tieneTurno || diasLectivosEsperados <= 0) {
    return {
      nivel: "BAJO" as NivelRiesgo,
      porcentaje: 0,
    };
  }

  const porcentajeAusencias =
    (ausencias / diasLectivosEsperados) * 100;

  const porcentajeTardanzas =
    (tardanzas / diasLectivosEsperados) * 100;

  const porcentajeSinSalida =
    (sinSalida / diasLectivosEsperados) * 100;

  const porcentaje = limitarPorcentaje(
    porcentajeAusencias * 0.7 +
      porcentajeTardanzas * 0.25 +
      porcentajeSinSalida * 0.05
  );

  const nivel: NivelRiesgo =
    porcentaje >= 60
      ? "ALTO"
      : porcentaje >= 25
        ? "MEDIO"
        : "BAJO";

  return {
    nivel,
    porcentaje,
  };
}

function construirTextos({
  nivel,
  porcentaje,
  diasLectivosEsperados,
  diasConAsistencia,
  ausencias,
  tardanzas,
  sinSalida,
}: {
  nivel: NivelRiesgo;
  porcentaje: number;
  diasLectivosEsperados: number;
  diasConAsistencia: number;
  ausencias: number;
  tardanzas: number;
  sinSalida: number;
}) {
  if (diasLectivosEsperados <= 0) {
    return {
      resumen:
        "Todavía no existe historial lectivo suficiente para evaluar el comportamiento de asistencia del estudiante.",
      recomendacion:
        "Mantener el seguimiento durante los próximos días lectivos antes de emitir una conclusión preventiva.",
    };
  }

  const resumen =
    `Riesgo ${nivel.toLowerCase()} (${porcentaje}%). ` +
    `Registró asistencia en ${diasConAsistencia} de ${diasLectivosEsperados} días lectivos, ` +
    `con ${ausencias} ausencia(s), ${tardanzas} tardanza(s) y ${sinSalida} registro(s) sin salida.`;

  if (nivel === "ALTO") {
    return {
      resumen,
      recomendacion:
        "Realizar contacto prioritario con el padre o tutor, verificar las causas de las inasistencias y establecer un plan de seguimiento con la institución.",
    };
  }

  if (nivel === "MEDIO") {
    return {
      resumen,
      recomendacion:
        "Revisar la evolución semanal, conversar preventivamente con el tutor y reforzar el cumplimiento del horario escolar.",
    };
  }

  return {
    resumen,
    recomendacion:
      "Mantener el seguimiento habitual y reconocer la asistencia regular del estudiante, interviniendo solo si aparecen nuevas incidencias.",
  };
}

export async function GET() {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const total = await prisma.estudiante.count({
      where: {
        estado: true,
      },
    });

    return NextResponse.json({
      ok: true,
      total,
      limitePorLote: LIMITE_MAXIMO,
      totalLotes: Math.ceil(total / LIMITE_MAXIMO),
    });
  } catch (error) {
    console.error("Error contando estudiantes:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo obtener el total de estudiantes",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json().catch(() => ({}));

    const offset = Math.max(
      0,
      Number.isFinite(Number(body.offset))
        ? Math.trunc(Number(body.offset))
        : 0
    );

    const limite = Math.min(
      LIMITE_MAXIMO,
      Math.max(
        1,
        Number.isFinite(Number(body.limite))
          ? Math.trunc(Number(body.limite))
          : LIMITE_MAXIMO
      )
    );

    const periodo = obtenerPeriodoAnalisis();

    const [eventosCalendario, estudiantes, total] =
      await Promise.all([
        prisma.calendarioEscolar.findMany({
          where: {
            estado: true,
            fechaInicio: {
              lte: periodo.fin,
            },
            fechaFin: {
              gte: periodo.inicio,
            },
          },
          select: {
            fechaInicio: true,
            fechaFin: true,
            todosLosTurnos: true,
            turnoId: true,
          },
        }),

        prisma.estudiante.findMany({
          where: {
            estado: true,
          },
          skip: offset,
          take: limite,
          include: {
            turno: true,
            asistencias: {
              where: {
                fecha: {
                  gte: periodo.inicio,
                  lte: periodo.fin,
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
        }),

        prisma.estudiante.count({
          where: {
            estado: true,
          },
        }),
      ]);

    if (estudiantes.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No quedan estudiantes pendientes",
        total,
        offset,
        procesados: 0,
        siguienteOffset: offset,
        finalizado: true,
        resultados: [],
      });
    }

    const resultados: {
      estudianteId: number;
      estudiante: string;
      dni: string;
      nivel: NivelRiesgo;
      porcentaje: number;
      ausencias: number;
      tardanzas: number;
      sinSalida: number;
    }[] = [];

    let altos = 0;
    let medios = 0;
    let bajos = 0;

    for (const estudiante of estudiantes) {
      const fechaRegistro =
        fechaPeruString(estudiante.createdAt);

      const fechaInicioReal =
        fechaRegistro > periodo.fechaInicio
          ? fechaRegistro
          : periodo.fechaInicio;

      const fechasPeriodo =
        generarFechasPeriodo(
          fechaInicioReal,
          periodo.fechaFin
        );

      const fechasLectivas = estudiante.turno
        ? fechasPeriodo.filter((fecha) => {
            if (esFinDeSemana(fecha)) {
              return false;
            }

            return !existeEventoNoLectivo(
              fecha,
              estudiante.turnoId,
              eventosCalendario
            );
          })
        : [];

      const conjuntoFechasLectivas =
        new Set(fechasLectivas);

      const asistenciasLectivas =
        estudiante.asistencias.filter(
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

      const diasLectivosEsperados =
        fechasLectivas.length;

      const diasConAsistencia =
        fechasConAsistencia.size;

      const ausencias = Math.max(
        diasLectivosEsperados - diasConAsistencia,
        0
      );

      const tardanzas =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.estado === "TARDE"
        ).length;

      const sinSalida =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.horaEntrada !== null &&
            asistencia.horaSalida === null
        ).length;

      const riesgo = calcularRiesgo({
        tieneTurno: Boolean(estudiante.turno),
        diasLectivosEsperados,
        ausencias,
        tardanzas,
        sinSalida,
      });

      const textos = construirTextos({
        nivel: riesgo.nivel,
        porcentaje: riesgo.porcentaje,
        diasLectivosEsperados,
        diasConAsistencia,
        ausencias,
        tardanzas,
        sinSalida,
      });

      await prisma.riesgoEstudianteIA.upsert({
        where: {
          estudianteId: estudiante.id,
        },
        update: {
          nivel: riesgo.nivel,
          porcentaje: riesgo.porcentaje,
          resumen: textos.resumen,
          recomendacion: textos.recomendacion,
        },
        create: {
          estudianteId: estudiante.id,
          nivel: riesgo.nivel,
          porcentaje: riesgo.porcentaje,
          resumen: textos.resumen,
          recomendacion: textos.recomendacion,
        },
      });

      if (riesgo.nivel === "ALTO") altos++;
      if (riesgo.nivel === "MEDIO") medios++;
      if (riesgo.nivel === "BAJO") bajos++;

      resultados.push({
        estudianteId: estudiante.id,
        estudiante:
          `${estudiante.nombres} ${estudiante.apellidos}`,
        dni: estudiante.dni,
        nivel: riesgo.nivel,
        porcentaje: riesgo.porcentaje,
        ausencias,
        tardanzas,
        sinSalida,
      });
    }

    const siguienteOffset =
      offset + estudiantes.length;

    return NextResponse.json({
      ok: true,
      message: "Lote procesado correctamente",
      total,
      offset,
      limite,
      procesados: estudiantes.length,
      siguienteOffset,
      finalizado: siguienteOffset >= total,
      resumenLote: {
        altos,
        medios,
        bajos,
      },
      resultados,
    });
  } catch (error: unknown) {
    console.error("Error procesando lote de riesgo IA:", error);

    const message =
      error instanceof Error
        ? error.message
        : "No se pudo procesar el lote de estudiantes";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}