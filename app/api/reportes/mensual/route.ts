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

function sumarDias(fecha: string, dias: number) {
  const base = crearFechaPeru(fecha);
  base.setDate(base.getDate() + dias);

  return fechaPeruString(base);
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
  const dia = valor.getDay();

  return dia === 0 || dia === 6;
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

    const mes = Number(searchParams.get("mes"));
    const anio = Number(searchParams.get("anio"));
    const turno = searchParams.get("turno") || "TODOS";
    const grado = searchParams.get("grado") || "TODOS";
    const seccion = searchParams.get("seccion") || "TODOS";

    if (!mes || !anio || mes < 1 || mes > 12) {
      return NextResponse.json(
        { message: "Mes y año son obligatorios y deben ser válidos" },
        { status: 400 }
      );
    }

    const fechaInicioString = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const totalDias = new Date(anio, mes, 0).getDate();

    const fechaFinString = `${anio}-${String(mes).padStart(2, "0")}-${String(
      totalDias
    ).padStart(2, "0")}`;

    const inicioMes = crearFechaPeru(fechaInicioString);
    const finMes = crearFechaPeru(fechaFinString, true);

    const hoy = fechaPeruString(new Date());

const esMesActual =
  anio === Number(hoy.slice(0, 4)) &&
  mes === Number(hoy.slice(5, 7));

const fechasMesCompleto = generarFechasMes(anio, mes);

const fechasMes = esMesActual
  ? fechasMesCompleto.filter((fecha) => fecha <= hoy)
  : fechasMesCompleto;

    const eventosCalendario = await prisma.calendarioEscolar.findMany({
      where: {
        estado: true,
        fechaInicio: {
          lte: finMes,
        },
        fechaFin: {
          gte: inicioMes,
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
        ...(grado !== "TODOS" ? { grado } : {}),
        ...(seccion !== "TODOS" ? { seccion } : {}),
        ...(turno !== "TODOS"
          ? {
              turno: {
                nombre: turno,
              },
            }
          : {}),
      },
      include: {
        turno: true,
        asistencias: {
          where: {
            fecha: {
              gte: inicioMes,
              lte: finMes,
            },
          },
          orderBy: {
            fecha: "asc",
          },
        },
      },
      orderBy: {
        apellidos: "asc",
      },
    });

    const detalle = estudiantes.map((estudiante) => {
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

      const conjuntoLectivo = new Set(fechasLectivas);

      const asistenciasLectivas = estudiante.asistencias.filter(
        (asistencia) =>
          conjuntoLectivo.has(fechaPeruString(asistencia.fecha))
      );

      const fechasConAsistencia = new Set(
        asistenciasLectivas.map((asistencia) =>
          fechaPeruString(asistencia.fecha)
        )
      );

      const diasLectivosEsperados = fechasLectivas.length;
      const presentes = fechasConAsistencia.size;
      const ausentes = Math.max(diasLectivosEsperados - presentes, 0);

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
          ? Number(
              ((presentes / diasLectivosEsperados) * 100).toFixed(2)
            )
          : 0;

      const porcentajePuntualidad =
        presentes > 0
          ? Number(((puntuales / presentes) * 100).toFixed(2))
          : 0;

      const fechasAusencia = fechasLectivas.filter(
        (fecha) => !fechasConAsistencia.has(fecha)
      );

      return {
        id: estudiante.id,
        estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
        dni: estudiante.dni,
        grado: `${estudiante.grado} - ${estudiante.seccion}`,
        gradoSolo: estudiante.grado,
        seccion: estudiante.seccion,
        turno: estudiante.turno?.nombre || "Sin turno",

        diasLectivosEsperados,
        presentes,
        ausentes,
        puntuales,
        tardanzas,
        sinSalida,
        porcentajeAsistencia,
        porcentajePuntualidad,
        fechasAusencia,
      };
    });

    const resumen = {
      totalEstudiantes: estudiantes.length,

      totalDiasLectivosEsperados: detalle.reduce(
        (acumulado, estudiante) =>
          acumulado + estudiante.diasLectivosEsperados,
        0
      ),

      totalPresentes: detalle.reduce(
        (acumulado, estudiante) =>
          acumulado + estudiante.presentes,
        0
      ),

      totalAusentes: detalle.reduce(
        (acumulado, estudiante) =>
          acumulado + estudiante.ausentes,
        0
      ),

      totalPuntuales: detalle.reduce(
        (acumulado, estudiante) =>
          acumulado + estudiante.puntuales,
        0
      ),

      totalTardanzas: detalle.reduce(
        (acumulado, estudiante) =>
          acumulado + estudiante.tardanzas,
        0
      ),

      totalSinSalida: detalle.reduce(
        (acumulado, estudiante) =>
          acumulado + estudiante.sinSalida,
        0
      ),
    };

    const porcentajeAsistenciaGeneral =
      resumen.totalDiasLectivosEsperados > 0
        ? Number(
            (
              (resumen.totalPresentes /
                resumen.totalDiasLectivosEsperados) *
              100
            ).toFixed(2)
          )
        : 0;

   return NextResponse.json({
  mes,
  anio,
  turno,
  grado,
  seccion,

  totalDias,
  totalDiasConsiderados: fechasMes.length,
  mesEnCurso: esMesActual,

  periodo: {
    desde: fechaInicioString,
    hasta: esMesActual ? hoy : fechaFinString,
  },

  eventosNoLectivosExcluidos: eventosCalendario.map((evento) => ({
    tipo: evento.tipo,
    descripcion: evento.descripcion,
    desde: fechaBDString(evento.fechaInicio),
    hasta: fechaBDString(evento.fechaFin),
    aplicacion: evento.todosLosTurnos
      ? "Todos los turnos"
      : `Turno ID ${evento.turnoId}`,
  })),

  porcentajeAsistenciaGeneral,
  resumen,
  detalle,
});
  } catch (error) {
    console.error("Error generando reporte mensual:", error);

    return NextResponse.json(
      { message: "Error al generar reporte mensual" },
      { status: 500 }
    );
  }
}