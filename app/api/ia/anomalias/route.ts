import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarAnalisisIA } from "@/services/groqService";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZONA_HORARIA = "America/Lima";
const DIAS_ANALISIS = 30;

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

type EventoCalendario = {
  fechaInicio: Date;
  fechaFin: Date;
  todosLosTurnos: boolean;
  turnoId: number | null;
  descripcion: string;
  tipo: string;
};

type ResultadoRiesgo = {
  nivel: NivelRiesgo;
  porcentaje: number;
  explicacion: string;
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

  // Se analiza hasta ayer para evitar contar el día actual
  // como ausencia antes de que termine la jornada escolar.
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

function generarFechasPeriodo(
  fechaInicio: string,
  fechaFin: string
) {
  if (fechaInicio > fechaFin) {
    return [];
  }

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
      fecha >= inicioEvento &&
      fecha <= finEvento;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos &&
        evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
}

function limitarPorcentaje(valor: number) {
  return Math.min(100, Math.max(0, Math.round(valor)));
}

function calcularRiesgoObjetivo({
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
}): ResultadoRiesgo {
  if (!tieneTurno) {
    return {
      nivel: "BAJO",
      porcentaje: 0,
      explicacion:
        "No se calculó riesgo porque el estudiante no tiene turno asignado.",
    };
  }

  if (diasLectivosEsperados <= 0) {
    return {
      nivel: "BAJO",
      porcentaje: 0,
      explicacion:
        "Todavía no existen días lectivos completos suficientes para calcular riesgo.",
    };
  }

  const porcentajeAusencias =
    (ausencias / diasLectivosEsperados) * 100;

  const porcentajeTardanzas =
    (tardanzas / diasLectivosEsperados) * 100;

  const porcentajeSinSalida =
    (sinSalida / diasLectivosEsperados) * 100;

  /*
   * Fórmula objetiva:
   * - Ausencias: 70%
   * - Tardanzas: 25%
   * - Registros sin salida: 5%
   */
  const riesgoCalculado =
    porcentajeAusencias * 0.7 +
    porcentajeTardanzas * 0.25 +
    porcentajeSinSalida * 0.05;

  const porcentaje = limitarPorcentaje(riesgoCalculado);

  const nivel: NivelRiesgo =
    porcentaje >= 60
      ? "ALTO"
      : porcentaje >= 25
      ? "MEDIO"
      : "BAJO";

  return {
    nivel,
    porcentaje,
    explicacion:
      `Ausencias: ${ausencias}/${diasLectivosEsperados}; ` +
      `tardanzas: ${tardanzas}; sin salida: ${sinSalida}.`,
  };
}

export async function GET(request: Request) {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);
    const dni = searchParams.get("dni")?.trim() || null;

    const periodo = obtenerPeriodoAnalisis();

    const eventosCalendario =
      await prisma.calendarioEscolar.findMany({
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
          descripcion: true,
          tipo: true,
        },
      });

    const estudiantes = await prisma.estudiante.findMany({
      where: {
        estado: true,
        ...(dni ? { dni } : {}),
      },
      include: {
        turno: true,
        riesgoIA: true,
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
    });

    if (estudiantes.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: dni
            ? "No se encontró un estudiante activo con ese DNI"
            : "No se encontraron estudiantes para analizar",
        },
        {
          status: 404,
        }
      );
    }

    const resumen = estudiantes.map((estudiante) => {
      /*
       * Nunca contamos como ausencia los días anteriores a la fecha
       * en que el estudiante fue creado en el sistema.
       */
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
          (asistencia) => {
            const fechaAsistencia =
              fechaPeruString(asistencia.fecha);

            return conjuntoFechasLectivas.has(
              fechaAsistencia
            );
          }
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
        diasLectivosEsperados -
          diasConAsistencia,
        0
      );

      const tardanzas =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.estado === "TARDE"
        ).length;

      const puntuales =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.estado === "PUNTUAL"
        ).length;

      const sinSalida =
        asistenciasLectivas.filter(
          (asistencia) =>
            asistencia.horaEntrada !== null &&
            asistencia.horaSalida === null
        ).length;

      const porcentajeAsistencia =
        diasLectivosEsperados > 0
          ? Math.round(
              (diasConAsistencia /
                diasLectivosEsperados) *
                100
            )
          : 0;

      const porcentajePuntualidad =
        diasConAsistencia > 0
          ? Math.round(
              (puntuales /
                diasConAsistencia) *
                100
            )
          : 0;

      const porcentajeTardanzas =
        diasConAsistencia > 0
          ? Math.round(
              (tardanzas /
                diasConAsistencia) *
                100
            )
          : 0;

      const horariosEntrada =
        asistenciasLectivas
          .filter(
            (asistencia) =>
              asistencia.horaEntrada
          )
          .map((asistencia) => ({
            fecha:
              fechaPeruString(
                asistencia.fecha
              ),
            hora:
              asistencia.horaEntrada?.toLocaleTimeString(
                "es-PE",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: ZONA_HORARIA,
                }
              ),
            estado: asistencia.estado,
          }));

      const fechasAusencia =
        fechasLectivas.filter(
          (fecha) =>
            !fechasConAsistencia.has(fecha)
        );

      const riesgoCalculado =
        calcularRiesgoObjetivo({
          tieneTurno:
            Boolean(estudiante.turno),
          diasLectivosEsperados,
          ausencias,
          tardanzas,
          sinSalida,
        });

      return {
        estudiante:
          `${estudiante.nombres} ${estudiante.apellidos}`,
        dni: estudiante.dni,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        fechaRegistro,

        turno: estudiante.turno
          ? `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`
          : "Sin turno",

        tieneTurnoAsignado:
          Boolean(estudiante.turno),

        periodo: {
          desde: fechaInicioReal,
          hasta: periodo.fechaFin,
          diasCalendarioMaximos:
            DIAS_ANALISIS,
        },

        diasLectivosEsperados,
        diasConAsistencia,
        ausencias,
        puntuales,
        tardanzas,
        sinSalida,
        porcentajeAsistencia,
        porcentajePuntualidad,
        porcentajeTardanzas,
        fechasAusencia,
        horariosEntrada,

        riesgoCalculado: {
          nivel: riesgoCalculado.nivel,
          porcentaje:
            riesgoCalculado.porcentaje,
          explicacion:
            riesgoCalculado.explicacion,
        },
      };
    });

    const eventosInformativos =
      eventosCalendario.map((evento) => ({
        tipo: evento.tipo,
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
        aplicacion:
          evento.todosLosTurnos
            ? "Todos los turnos"
            : `Turno ID ${evento.turnoId}`,
      }));

    /*
     * Groq ya no calcula ni clasifica el riesgo.
     * El sistema entrega los valores objetivos y la IA solo redacta.
     */
    const prompt = `
Eres un asistente experto en asistencia escolar y alerta temprana.

El sistema ya calculó matemáticamente los indicadores y el riesgo de cada estudiante.
NO debes modificar, reinterpretar ni reemplazar:
- diasLectivosEsperados
- diasConAsistencia
- ausencias
- puntuales
- tardanzas
- sinSalida
- porcentajeAsistencia
- porcentajePuntualidad
- porcentajeTardanzas
- riesgoCalculado.nivel
- riesgoCalculado.porcentaje

IMPORTANTE:
- Nunca inventes ausencias, tardanzas, porcentajes ni causas.
- Nunca clasifiques a un estudiante con un nivel distinto al riesgoCalculado.nivel.
- Si diasLectivosEsperados es 0, explica que todavía no existe historial lectivo suficiente.
- Si el riesgo es BAJO, usa lenguaje tranquilo y no alarmista.
- Las causas personales, familiares, médicas, psicológicas o económicas solo pueden mencionarse como hipótesis que requieren verificación.
- Usa exclusivamente los datos entregados.

Eventos no lectivos excluidos:
${JSON.stringify(eventosInformativos, null, 2)}

Datos objetivos de estudiantes:
${JSON.stringify(resumen, null, 2)}

Redacta en español con esta estructura:

1. Resumen general.
2. Clasificación actual de los estudiantes.
3. Evidencias observadas en los datos.
4. Aspectos que deben verificarse.
5. Recomendaciones para padres o tutores.
6. Recomendaciones para la institución educativa.

En la sección 2, copia exactamente el nivel y porcentaje incluidos en riesgoCalculado.
Usa un tono profesional, claro, preventivo y humano.
`;

    const analisis =
      await generarAnalisisIA(prompt);

    await prisma.analisisIA.create({
      data: {
        tipo: dni
          ? "INDIVIDUAL"
          : "GENERAL",
        dni,
        resultado: analisis,
      },
    });

    return NextResponse.json({
      ok: true,
      modo: dni
        ? "individual"
        : "general",

      periodo: {
        desde:
          periodo.fechaInicio,
        hasta:
          periodo.fechaFin,
        diasCalendarioMaximos:
          DIAS_ANALISIS,
      },

      eventosNoLectivosExcluidos:
        eventosInformativos,

      estudiantesAnalizados:
        estudiantes.length,

      datos: resumen,
      analisis,
    });
  } catch (error: unknown) {
    console.error(
      "Error IA anomalías:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error al generar análisis de anomalías";

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