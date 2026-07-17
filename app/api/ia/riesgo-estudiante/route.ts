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
  tipo: string;
  descripcion: string;
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
  const fechaBase = crearFechaPeru(fecha);
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

    const aplicaFecha = fecha >= fechaInicio && fecha <= fechaFin;

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
        "Todavía no existen días lectivos suficientes desde el registro del estudiante.",
    };
  }

  const porcentajeAusencias =
    (ausencias / diasLectivosEsperados) * 100;

  const porcentajeTardanzas =
    (tardanzas / diasLectivosEsperados) * 100;

  const porcentajeSinSalida =
    (sinSalida / diasLectivosEsperados) * 100;

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

    const fechaRegistroEstudiante =
      fechaPeruString(estudiante.createdAt);

    const fechaInicioReal =
      fechaRegistroEstudiante > periodo.fechaInicio
        ? fechaRegistroEstudiante
        : periodo.fechaInicio;

    const fechasPeriodo =
      fechaInicioReal <= periodo.fechaFin
        ? generarFechasPeriodo(
            fechaInicioReal,
            periodo.fechaFin
          )
        : [];

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
        const fechaAsistencia =
          fechaPeruString(asistencia.fecha);

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
        hora: asistencia.horaEntrada?.toLocaleTimeString(
          "es-PE",
          {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: ZONA_HORARIA,
          }
        ),
        estado: asistencia.estado,
      }));

    const eventosNoLectivosExcluidos =
      eventosCalendario.map((evento) => ({
        tipo: evento.tipo,
        descripcion: evento.descripcion,
        desde: fechaBDString(evento.fechaInicio),
        hasta: fechaBDString(evento.fechaFin),
        aplicacion: evento.todosLosTurnos
          ? "Todos los turnos"
          : estudiante.turno?.nombre || "Turno específico",
      }));

    const riesgoObjetivo = calcularRiesgoObjetivo({
      tieneTurno: Boolean(estudiante.turno),
      diasLectivosEsperados,
      ausencias,
      tardanzas,
      sinSalida,
    });

    const datos = {
      estudiante:
        `${estudiante.nombres} ${estudiante.apellidos}`,
      dni: estudiante.dni,
      grado: estudiante.grado,
      seccion: estudiante.seccion,
      fechaRegistro: fechaRegistroEstudiante,
      turno: estudiante.turno
        ? `${estudiante.turno.nombre} (${estudiante.turno.horaEntrada} - ${estudiante.turno.horaSalida})`
        : "Sin turno",
      tieneTurnoAsignado: Boolean(estudiante.turno),
      periodo: {
        desde: fechaInicioReal,
        hasta: periodo.fechaFin,
        diasCalendarioMaximos: DIAS_ANALISIS,
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
      riesgoCalculado: riesgoObjetivo,
      fechasAusencia,
      horariosEntrada,
      eventosNoLectivosExcluidos,
    };

    const prompt = `
Eres un asistente experto en asistencia escolar y alerta temprana.

El sistema ya calculó matemáticamente el nivel y porcentaje de riesgo.
NO debes modificarlos, reinterpretarlos ni proponer otros valores.

Tu única tarea es redactar:
1. Un resumen profesional y breve.
2. Una recomendación preventiva y clara.

Reglas:
- Usa únicamente los datos proporcionados.
- No inventes problemas familiares, médicos, psicológicos o económicos.
- Las causas deben expresarse como hipótesis que requieren verificación.
- Si hay pocos datos, indícalo claramente.
- Si el riesgo es bajo, no uses lenguaje alarmista.
- Si todavía no existen días lectivos desde el registro, explica que falta historial.
- Responde SOLO con JSON válido, sin Markdown ni texto adicional.

Estructura exacta:

{
  "resumen": "Resumen profesional y breve basado en los datos",
  "recomendacion": "Recomendación preventiva y clara para el padre, tutor o institución"
}

Datos:
${JSON.stringify(datos, null, 2)}
`;

    const respuestaIA = await generarAnalisisIA(prompt);
    const analisis = extraerJSON(respuestaIA);

    const resumen = String(analisis.resumen || "").trim();
    const recomendacion = String(
      analisis.recomendacion || ""
    ).trim();

    if (!resumen || !recomendacion) {
      throw new Error(
        "La IA no devolvió el resumen y la recomendación requeridos"
      );
    }

    const riesgo =
      await prisma.riesgoEstudianteIA.upsert({
        where: {
          estudianteId: estudiante.id,
        },
        update: {
          nivel: riesgoObjetivo.nivel,
          porcentaje: riesgoObjetivo.porcentaje,
          resumen,
          recomendacion,
        },
        create: {
          estudianteId: estudiante.id,
          nivel: riesgoObjetivo.nivel,
          porcentaje: riesgoObjetivo.porcentaje,
          resumen,
          recomendacion,
        },
      });

    return NextResponse.json({
      ok: true,
      message: "Riesgo actualizado correctamente",
      estudiante: {
        id: estudiante.id,
        dni: estudiante.dni,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        turno: estudiante.turno?.nombre || null,
        fechaRegistro: fechaRegistroEstudiante,
      },
      periodo: {
        desde: fechaInicioReal,
        hasta: periodo.fechaFin,
        diasCalendarioMaximos: DIAS_ANALISIS,
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
      calculoRiesgo: riesgoObjetivo,
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