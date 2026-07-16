import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDemoOPersonal } from "@/lib/auth";

const ZONA_HORARIA = "America/Lima";


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

function generarFechasMes(anio: number, mes: number) {
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fechas: string[] = [];

  for (let dia = 1; dia <= ultimoDia; dia++) {
    fechas.push(
      `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(
        2,
        "0"
      )}`
    );
  }

  return fechas;
}

function esFinDeSemana(fecha: string) {
  const valor = new Date(`${fecha}T12:00:00-05:00`);
  const diaSemana = valor.getDay();

  return diaSemana === 0 || diaSemana === 6;
}

function hora(fecha: Date | null | undefined) {
  if (!fecha) return "-";

  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
  });
}

type EventoCalendario = {
  fechaInicio: Date;
  fechaFin: Date;
  todosLosTurnos: boolean;
  turnoId: number | null;
  tipo: string;
  descripcion: string;
};

function esDiaNoLectivo(
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

export async function GET(request: Request) {
  const acceso = await exigirAdminDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);

    const dni = String(searchParams.get("dni") || "").trim();
    const mes = Number(searchParams.get("mes"));
    const anio = Number(searchParams.get("anio"));

    if (!dni || !mes || !anio || mes < 1 || mes > 12) {
      return NextResponse.json(
        { message: "DNI, mes y año son obligatorios y deben ser válidos" },
        { status: 400 }
      );
    }

    const fechaInicioString = `${anio}-${String(mes).padStart(2, "0")}-01`;

    const totalDias = new Date(anio, mes, 0).getDate();

    const fechaFinString = `${anio}-${String(mes).padStart(2, "0")}-${String(
      totalDias
    ).padStart(2, "0")}`;

    const hoy = fechaPeruString(new Date());

    const anioActual = Number(hoy.slice(0, 4));
    const mesActual = Number(hoy.slice(5, 7));

    const esMesActual =
      anio === anioActual &&
      mes === mesActual;

    const ayerDate = new Date(`${hoy}T12:00:00-05:00`);
    ayerDate.setDate(ayerDate.getDate() - 1);

    const ayer = fechaPeruString(ayerDate);

    const fechaLimiteReporte = esMesActual
      ? ayer
      : fechaFinString;

    const inicioAsistencias = crearFechaPeru(fechaInicioString);
    const finAsistencias = crearFechaPeru(fechaLimiteReporte, true);

    const inicioCalendario = new Date(
      `${fechaInicioString}T00:00:00.000Z`
    );

    const finCalendario = new Date(
      `${fechaLimiteReporte}T00:00:00.000Z`
    );

    const estudiante = await prisma.estudiante.findUnique({
      where: {
        dni,
      },
      include: {
        turno: true,
        asistencias: {
          where: {
            fecha: {
              gte: inicioAsistencias,
              lte: finAsistencias,
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
        { message: "Estudiante no encontrado" },
        { status: 404 }
      );
    }

    const eventosCalendario = await prisma.calendarioEscolar.findMany({
      where: {
        estado: true,
        fechaInicio: {
          lte: finCalendario,
        },
        fechaFin: {
          gte: inicioCalendario,
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

    const fechasMes = generarFechasMes(anio, mes).filter(
      (fecha) => fecha <= fechaLimiteReporte
    );

    const fechasLectivas = estudiante.turno
      ? fechasMes.filter((fecha) => {
          if (esFinDeSemana(fecha)) {
            return false;
          }

          return !esDiaNoLectivo(
            fecha,
            estudiante.turnoId,
            eventosCalendario
          );
        })
      : [];

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
    const ausentes = Math.max(
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
        ? Number(
            ((presentes / diasLectivosEsperados) * 100).toFixed(2)
          )
        : 0;

    const porcentajePuntualidad =
      presentes > 0
        ? Number(
            ((puntuales / presentes) * 100).toFixed(2)
          )
        : 0;

    const fechasAusencia = fechasLectivas.filter(
      (fecha) => !fechasConAsistencia.has(fecha)
    );

    const detalle = asistenciasLectivas.map((asistencia) => ({
      id: asistencia.id,
      fecha: asistencia.fecha,
      fechaTexto: fechaPeruString(asistencia.fecha),
      entrada: hora(asistencia.horaEntrada),
      salida: hora(asistencia.horaSalida),
      estado: asistencia.estado,
      metodo: asistencia.metodo,
    }));

    return NextResponse.json({
      estudiante: {
        id: estudiante.id,
        codigo: estudiante.codigo,
        dni: estudiante.dni,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        turno: estudiante.turno?.nombre || "Sin turno",
        horaEntrada: estudiante.turno?.horaEntrada || null,
        horaSalida: estudiante.turno?.horaSalida || null,
      },

      periodo: {
        mes,
        anio,
        desde: fechaInicioString,
        hasta: fechaLimiteReporte,
        mesEnCurso: esMesActual,
      },

      resumen: {
        totalDias,
        diasConsiderados: fechasMes.length,
        diasLectivosEsperados,
        presentes,
        ausentes,
        puntuales,
        tardanzas,
        sinSalida,
        porcentajeAsistencia,
        porcentajePuntualidad,
      },

      fechasAusencia,

      eventosNoLectivosExcluidos: eventosCalendario.map((evento) => ({
        tipo: evento.tipo,
        descripcion: evento.descripcion,
        desde: fechaBDString(evento.fechaInicio),
        hasta: fechaBDString(evento.fechaFin),
        aplicacion: evento.todosLosTurnos
          ? "Todos los turnos"
          : estudiante.turno?.nombre || "Turno específico",
      })),

      detalle,
    });
  } catch (error) {
    console.error(
      "Error generando reporte del estudiante:",
      error
    );

    return NextResponse.json(
      {
        message: "Error al generar reporte del estudiante",
      },
      { status: 500 }
    );
  }
}