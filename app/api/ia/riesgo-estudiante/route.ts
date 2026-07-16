import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarAnalisisIA } from "@/services/groqService";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";

const ZONA_HORARIA = "America/Lima";
const DIAS_ANALISIS = 30;

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

function sumarDias(fecha: string, dias: number) {
  const fechaBase = crearFechaPeru(fecha);
  fechaBase.setDate(fechaBase.getDate() + dias);

  return fechaPeruString(fechaBase);
}

function obtenerPeriodoAnalisis() {
  const hoy = fechaPeruString(new Date());

  // Se analiza hasta ayer para no considerar el día actual como ausencia
  // antes de que termine la jornada escolar.
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
    const fechaInicio = fechaBDString(evento.fechaInicio);
    const fechaFin = fechaBDString(evento.fechaFin);

    const aplicaFecha =
      fecha >= fechaInicio &&
      fecha <= fechaFin;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos && evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
}

function extraerJSON(texto: string) {
  const textoLimpio = texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const inicio = textoLimpio.indexOf("{");
  const fin = textoLimpio.lastIndexOf("}");

  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error("La IA no devolvió un JSON válido");
  }

  return JSON.parse(textoLimpio.slice(inicio, fin + 1));
}

function normalizarNivel(valor: unknown) {
  const nivel = String(valor || "").trim().toUpperCase();

  if (nivel === "ALTO" || nivel === "MEDIO" || nivel === "BAJO") {
    return nivel;
  }

  return "BAJO";
}

function normalizarPorcentaje(valor: unknown) {
  const porcentaje = Number(valor);

  if (!Number.isFinite(porcentaje)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(porcentaje)));
}

export async function POST(request: Request) {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();
    const dni = String(body.dni || "").trim();

    if (!dni) {
      return NextResponse.json(
        {
          ok: false,
          message: "DNI requerido",
        },
        { status: 400 }
      );
    }

    const periodo = obtenerPeriodoAnalisis();

    const estudiante = await prisma.estudiante.findUnique({
      where: {
        dni,
      },
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
    });

    if (!estudiante) {
      return NextResponse.json(
        {
          ok: false,
          message: "Estudiante no encontrado",
        },
        { status: 404 }
      );
    }

    if (!estudiante.estado) {
      return NextResponse.json(
        {
          ok: false,
          message: "El estudiante se encuentra inactivo",
        },
        { status: 400 }
      );
    }

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
          OR: [
            {
              todosLosTurnos: true,
            },
            {
              todosLosTurnos: false,
              turnoId: estudiante.turnoId,
            },
          ],
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

    const fechasPeriodo = generarFechasPeriodo(
      periodo.fechaInicio,
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

    const conjuntoFechasLectivas = new Set(fechasLectivas);

    const asistenciasLectivas = estudiante.asistencias.filter(
      (asistencia) => {
        const fechaAsistencia = fechaPeruString(asistencia.fecha);

        return conjuntoFechasLectivas.has(fechaAsistencia);
      }
    );

    const fechasConAsistencia = new Set(
      asistenciasLectivas.map((asistencia) =>
        fechaPeruString(asistencia.fecha)
      )
    );

    const diasLectivosEsperados = fechasLectivas.length;
    const diasConAsistencia = fechasConAsistencia.size;

    const ausencias = Math.max(
      diasLectivosEsperados - diasConAsistencia,
      0
    );

    const tardanzas = asistenciasLectivas.filter(
      (asistencia) => asistencia.estado === "TARDE"
    ).length;

    const puntuales = asistenciasLectivas.filter(
      (asistencia) => asistencia.estado === "PUNTUAL"
    ).length;

    const sinSalida = asistenciasLectivas.filter(
      (asistencia) =>
        asistencia.horaEntrada !== null &&
        asistencia.horaSalida === null
    ).length;

    const porcentajeAsistencia =
      diasLectivosEsperados > 0
        ? Math.round(
            (diasConAsistencia / diasLectivosEsperados) * 100
          )
        : 0;

    const porcentajePuntualidad =
      diasConAsistencia > 0
        ? Math.round((puntuales / diasConAsistencia) * 100)
        : 0;

    const porcentajeTardanzas =
      diasConAsistencia > 0
        ? Math.round((tardanzas / diasConAsistencia) * 100)
        : 0;

    const fechasAusencia = fechasLectivas.filter(
      (fecha) => !fechasConAsistencia.has(fecha)
    );

    const horariosEntrada = asistenciasLectivas
      .filter((asistencia) => asistencia.horaEntrada)
      .map((asistencia) => ({
        fecha: fechaPeruString(asistencia.fecha),
        hora: asistencia.horaEntrada?.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: ZONA_HORARIA,
        }),
        estado: asistencia.estado,
      }));

    const eventosNoLectivosExcluidos = eventosCalendario.map(
      (evento) => ({
        tipo: evento.tipo,
        descripcion: evento.descripcion,
        desde: fechaBDString(evento.fechaInicio),
        hasta: fechaBDString(evento.fechaFin),
        aplicacion: evento.todosLosTurnos
          ? "Todos los turnos"
          : estudiante.turno?.nombre || "Turno específico",
      })
    );

    const datos = {
      estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
      dni: estudiante.dni,
      grado: estudiante.grado,
      seccion: estudiante.seccion,

      turno: estudiante.turno
        ? `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`
        : "Sin turno",

      tieneTurnoAsignado: Boolean(estudiante.turno),

      periodo: {
        desde: periodo.fechaInicio,
        hasta: periodo.fechaFin,
        diasCalendarioAnalizados: DIAS_ANALISIS,
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

      eventosNoLectivosExcluidos,
    };

    const prompt = `
Eres un sistema experto en asistencia escolar y alerta temprana.

Analiza el riesgo del siguiente estudiante usando únicamente sus datos
de asistencia de los últimos ${DIAS_ANALISIS} días completos.

IMPORTANTE:
- Los sábados y domingos ya fueron excluidos.
- Los feriados, vacaciones, suspensiones y días no lectivos ya fueron excluidos.
- "diasLectivosEsperados" son los días reales en los que debía asistir.
- "ausencias" representa días lectivos sin registro.
- No inventes problemas familiares, médicos, psicológicos o económicos.
- Las causas deben redactarse como hipótesis que necesitan verificación.
- Si no tiene turno asignado o existen pocos datos, indícalo claramente.
- No clasifiques con riesgo alto solo por tener pocos datos.
- Basa el porcentaje en evidencias observables.

Debes responder SOLO con un JSON válido, sin Markdown ni texto adicional,
con esta estructura exacta:

{
  "nivel": "BAJO" | "MEDIO" | "ALTO",
  "porcentaje": 0,
  "resumen": "Resumen profesional y breve basado en los datos",
  "recomendacion": "Recomendación preventiva y clara para el padre, tutor o institución"
}

Criterios orientativos:
- Riesgo BAJO: asistencia estable, pocas ausencias y pocas tardanzas.
- Riesgo MEDIO: ausencias o tardanzas moderadas, registros sin salida o irregularidad creciente.
- Riesgo ALTO: asistencia muy baja, ausencias repetidas, tardanzas frecuentes o patrón claramente deteriorado.
- Considera el porcentaje de asistencia y la cantidad de días lectivos reales.
- Si no existen días lectivos en el periodo, indica riesgo preventivo bajo y falta de información.
- El porcentaje debe ser un número entero entre 0 y 100.

Datos:
${JSON.stringify(datos, null, 2)}
`;

    const respuestaIA = await generarAnalisisIA(prompt);
    const analisis = extraerJSON(respuestaIA);

    const nivel = normalizarNivel(analisis.nivel);
    const porcentaje = normalizarPorcentaje(analisis.porcentaje);
    const resumen = String(analisis.resumen || "").trim();
    const recomendacion = String(
      analisis.recomendacion || ""
    ).trim();

    if (!resumen || !recomendacion) {
      throw new Error(
        "La IA no devolvió el resumen y la recomendación requeridos"
      );
    }

    const riesgo = await prisma.riesgoEstudianteIA.upsert({
      where: {
        estudianteId: estudiante.id,
      },
      update: {
        nivel,
        porcentaje,
        resumen,
        recomendacion,
      },
      create: {
        estudianteId: estudiante.id,
        nivel,
        porcentaje,
        resumen,
        recomendacion,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Riesgo IA actualizado correctamente",

      estudiante: {
        id: estudiante.id,
        dni: estudiante.dni,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        turno: estudiante.turno?.nombre || null,
      },

      periodo: {
        desde: periodo.fechaInicio,
        hasta: periodo.fechaFin,
        diasCalendario: DIAS_ANALISIS,
      },

      indicadores: {
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
      },

      eventosNoLectivosExcluidos,

      riesgo,
    });
  } catch (error: unknown) {
    console.error("Error riesgo estudiante IA:", error);

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error al analizar riesgo del estudiante";

    return NextResponse.json(
      {
        ok: false,
        message: mensaje,
      },
      { status: 500 }
    );
  }
}