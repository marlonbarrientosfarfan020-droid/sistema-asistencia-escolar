import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarAnalisisIA } from "@/services/groqService";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";

const ZONA_HORARIA = "America/Lima";
const DIAS_ANALISIS = 30;

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

  // Usamos hasta ayer para no considerar el día actual
  // como ausencia antes de que terminen las clases.
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

type EventoCalendario = {
  fechaInicio: Date;
  fechaFin: Date;
  todosLosTurnos: boolean;
  turnoId: number | null;
  descripcion: string;
  tipo: string;
};

function existeEventoNoLectivo(
  fecha: string,
  turnoId: number | null,
  eventos: EventoCalendario[]
) {
  return eventos.some((evento) => {
    const inicioEvento = fechaBDString(evento.fechaInicio);
    const finEvento = fechaBDString(evento.fechaFin);

    const aplicaFecha = fecha >= inicioEvento && fecha <= finEvento;

    const aplicaTurno =
      evento.todosLosTurnos ||
      (!evento.todosLosTurnos && evento.turnoId === turnoId);

    return aplicaFecha && aplicaTurno;
  });
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

    const eventosCalendario = await prisma.calendarioEscolar.findMany({
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

    if (estudiantes.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: dni
            ? "No se encontró un estudiante activo con ese DNI"
            : "No se encontraron estudiantes para analizar",
        },
        { status: 404 }
      );
    }

    const fechasPeriodo = generarFechasPeriodo(
      periodo.fechaInicio,
      periodo.fechaFin
    );

    const resumen = estudiantes.map((estudiante) => {
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

      // Solo mantenemos registros pertenecientes a días lectivos reales.
      const asistenciasLectivas = estudiante.asistencias.filter((asistencia) => {
        const fechaAsistencia = fechaPeruString(asistencia.fecha);
        return conjuntoFechasLectivas.has(fechaAsistencia);
      });

      // Evita contar dos veces el mismo día si existieran registros duplicados.
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
          ? Math.round((diasConAsistencia / diasLectivosEsperados) * 100)
          : 0;

      const porcentajePuntualidad =
        diasConAsistencia > 0
          ? Math.round((puntuales / diasConAsistencia) * 100)
          : 0;

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

      const fechasAusencia = fechasLectivas.filter(
        (fecha) => !fechasConAsistencia.has(fecha)
      );

      return {
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
        fechasAusencia,
        horariosEntrada,
      };
    });

    const eventosInformativos = eventosCalendario.map((evento) => ({
      tipo: evento.tipo,
      descripcion: evento.descripcion,
      desde: fechaBDString(evento.fechaInicio),
      hasta: fechaBDString(evento.fechaFin),
      aplicacion: evento.todosLosTurnos
        ? "Todos los turnos"
        : `Turno ID ${evento.turnoId}`,
    }));

    const prompt = `
Eres un analista experto en asistencia escolar y alerta temprana.

Analiza los datos correspondientes a los últimos ${DIAS_ANALISIS} días completos,
desde ${periodo.fechaInicio} hasta ${periodo.fechaFin}.

IMPORTANTE:
- Los sábados y domingos ya fueron excluidos.
- Los feriados, vacaciones, suspensiones y días no lectivos ya fueron excluidos.
- "diasLectivosEsperados" representa los días reales en los que el estudiante debía asistir.
- "ausencias" representa días lectivos sin registro de asistencia.
- No inventes causas familiares, médicas, económicas o personales.
- Las posibles causas deben presentarse como hipótesis que requieren verificación.
- Si el estudiante no tiene turno asignado, indícalo como problema de configuración.
- Si existe poca información, señala que el resultado es preventivo y tiene datos insuficientes.

Eventos no lectivos excluidos:
${JSON.stringify(eventosInformativos, null, 2)}

Datos de estudiantes:
${JSON.stringify(resumen, null, 2)}

Clasifica a cada estudiante con:
- Riesgo bajo
- Riesgo medio
- Riesgo alto

Evalúa principalmente:
- porcentaje de asistencia;
- cantidad de ausencias reales;
- tardanzas frecuentes;
- registros sin salida;
- cambios o irregularidades en los horarios;
- cantidad suficiente o insuficiente de información.

Responde en español con esta estructura:

1. Resumen general.
2. Estudiantes con riesgo.
3. Evidencias observadas en los datos.
4. Posibles causas que deben verificarse.
5. Recomendaciones para padres o tutores.
6. Recomendaciones para la institución educativa.

Usa un tono profesional, claro, preventivo y humano.
`;

    const analisis = await generarAnalisisIA(prompt);

    await prisma.analisisIA.create({
      data: {
        tipo: dni ? "INDIVIDUAL" : "GENERAL",
        dni,
        resultado: analisis,
      },
    });

    return NextResponse.json({
      ok: true,
      modo: dni ? "individual" : "general",
      periodo: {
        desde: periodo.fechaInicio,
        hasta: periodo.fechaFin,
        diasCalendario: DIAS_ANALISIS,
      },
      eventosNoLectivosExcluidos: eventosInformativos,
      estudiantesAnalizados: estudiantes.length,
      datos: resumen,
      analisis,
    });
  } catch (error: unknown) {
    console.error("Error IA anomalías:", error);

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error al generar análisis de anomalías";

    return NextResponse.json(
      {
        ok: false,
        message: mensaje,
      },
      { status: 500 }
    );
  }
}