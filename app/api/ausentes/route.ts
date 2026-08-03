import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDemoOPersonal } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONA_HORARIA = "America/Lima";

function fechaActualPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fechaInicioPeru(fecha: string) {
  return new Date(
    `${fecha}T00:00:00.000-05:00`
  );
}

function fechaFinPeru(fecha: string) {
  return new Date(
    `${fecha}T23:59:59.999-05:00`
  );
}

function fechaCalendarioBD(fecha: string) {
  /*
   * CalendarioEscolar utiliza @db.Date.
   * Por eso se compara usando medianoche UTC.
   */
  return new Date(
    `${fecha}T00:00:00.000Z`
  );
}

function fechaHoraTurno(
  fecha: string,
  hora: string
) {
  const horaNormalizada =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(
      hora
    )
      ? hora
      : "00:00";

  return new Date(
    `${fecha}T${horaNormalizada}:00-05:00`
  );
}

function ahoraPeru() {
  const partes =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: ZONA_HORARIA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }
    ).formatToParts(new Date());

  const obtener = (
    tipo: Intl.DateTimeFormatPartTypes
  ) =>
    partes.find(
      (parte) =>
        parte.type === tipo
    )?.value || "00";

  return new Date(
    `${obtener("year")}-${obtener(
      "month"
    )}-${obtener("day")}T${obtener(
      "hour"
    )}:${obtener(
      "minute"
    )}:${obtener("second")}-05:00`
  );
}

function fechaValida(
  valor: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    valor
  );
}

export async function GET(
  request: Request
) {
  const acceso =
    await exigirAdminDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const fecha =
      searchParams.get("fecha") ||
      fechaActualPeru();

    const dni = String(
      searchParams.get("dni") || ""
    ).trim();

    const turnoIdTexto = String(
      searchParams.get("turnoId") || ""
    ).trim();

    const grado = String(
      searchParams.get("grado") || ""
    ).trim();

    const seccion = String(
      searchParams.get("seccion") || ""
    )
      .trim()
      .toUpperCase();

    if (!fechaValida(fecha)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La fecha seleccionada no es válida",
        },
        {
          status: 400,
        }
      );
    }

    const turnoId =
      turnoIdTexto
        ? Number(turnoIdTexto)
        : undefined;

    if (
      turnoIdTexto &&
      (!Number.isInteger(turnoId) ||
        Number(turnoId) <= 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El turno seleccionado no es válido",
        },
        {
          status: 400,
        }
      );
    }

    const inicioDia =
      fechaInicioPeru(fecha);

    const finDia =
      fechaFinPeru(fecha);

    const fechaBD =
      fechaCalendarioBD(fecha);

    const hoy =
      fechaActualPeru();

    const ahora =
      ahoraPeru();

    /*
     * Eventos no lectivos correspondientes
     * a la fecha consultada.
     */
    const eventosNoLectivos =
      await prisma.calendarioEscolar.findMany(
        {
          where: {
            estado: true,

            fechaInicio: {
              lte: fechaBD,
            },

            fechaFin: {
              gte: fechaBD,
            },
          },

          select: {
            id: true,
            descripcion: true,
            todosLosTurnos: true,
            turnoId: true,
          },
        }
      );

    const diaNoLectivoGeneral =
      eventosNoLectivos.some(
        (evento) =>
          evento.todosLosTurnos
      );

    function turnoEsNoLectivo(
      idTurno: number | null
    ) {
      return eventosNoLectivos.some(
        (evento) =>
          evento.todosLosTurnos ||
          (!evento.todosLosTurnos &&
            evento.turnoId ===
              idTurno)
      );
    }

    /*
     * Obtiene únicamente estudiantes activos.
     *
     * La comprobación definitiva del estado
     * del turno se realiza también en el filtro
     * para impedir falsos ausentes.
     */
    const estudiantes =
      await prisma.estudiante.findMany(
        {
          where: {
            estado: true,

            dni: dni
              ? {
                  contains: dni,
                }
              : undefined,

            turnoId,

            grado:
              grado || undefined,

            seccion:
              seccion || undefined,
          },

          include: {
            turno: true,

            asistencias: {
              where: {
                fecha: {
                  gte: inicioDia,
                  lte: finDia,
                },
              },

              select: {
                id: true,
                horaEntrada: true,
                estado: true,
              },
            },

            alertasAsistencia: {
              where: {
                fecha,
                tipo:
                  "AUSENCIA_CONFIRMADA",
              },

              select: {
                id: true,
                createdAt: true,
                tipo: true,
              },
            },
          },

          orderBy: [
            {
              turnoId: "asc",
            },
            {
              grado: "asc",
            },
            {
              seccion: "asc",
            },
            {
              apellidos: "asc",
            },
            {
              nombres: "asc",
            },
          ],
        }
      );

    const ausentes =
      estudiantes
        .filter(
          (estudiante) => {
            /*
             * Un estudiante sin turno no puede
             * evaluarse automáticamente.
             */
            if (
              !estudiante.turno
            ) {
              return false;
            }

            /*
             * CORRECCIÓN PRINCIPAL:
             *
             * Los estudiantes de turnos
             * desactivados nunca deben aparecer
             * como ausentes ni generar alertas.
             */
            if (
              !estudiante.turno
                .estado
            ) {
              return false;
            }

            /*
             * No se consideran ausencias durante
             * días no lectivos.
             */
            if (
              turnoEsNoLectivo(
                estudiante.turnoId
              )
            ) {
              return false;
            }

            /*
             * Si registró entrada,
             * no está ausente.
             */
            const registroEntrada =
              estudiante.asistencias.some(
                (asistencia) =>
                  asistencia.horaEntrada !==
                  null
              );

            if (registroEntrada) {
              return false;
            }

            /*
             * Fechas futuras nunca pueden
             * considerarse ausencias.
             */
            if (fecha > hoy) {
              return false;
            }

            /*
             * Para fechas anteriores:
             * si el turno estaba habilitado y
             * no existe entrada, se considera
             * ausente.
             */
            if (fecha < hoy) {
              return true;
            }

            /*
             * Para hoy, solamente se confirma
             * la ausencia después de finalizar
             * el turno activo.
             */
            const horaFinTurno =
              fechaHoraTurno(
                fecha,
                estudiante.turno
                  .horaSalida
              );

            return (
              ahora >=
              horaFinTurno
            );
          }
        )
        .map(
          (estudiante) => {
            const alerta =
              estudiante
                .alertasAsistencia[0] ||
              null;

            return {
              id: estudiante.id,
              codigo:
                estudiante.codigo,
              dni: estudiante.dni,
              nombres:
                estudiante.nombres,
              apellidos:
                estudiante.apellidos,
              grado:
                estudiante.grado,
              seccion:
                estudiante.seccion,

              nombreTutor:
                estudiante.nombreTutor,

              whatsapp:
                estudiante.whatsapp,

              telegramChatId:
                estudiante.telegramChatId,

              turno: {
                id:
                  estudiante.turno!.id,

                nombre:
                  estudiante.turno!
                    .nombre,

                horaEntrada:
                  estudiante.turno!
                    .horaEntrada,

                horaSalida:
                  estudiante.turno!
                    .horaSalida,

                activo:
                  estudiante.turno!
                    .estado,
              },

              estado: "AUSENTE",

              motivo:
                "No registró ingreso durante todo el turno activo",

              alertaEnviada:
                Boolean(alerta),

              fechaAlerta:
                alerta?.createdAt ||
                null,
            };
          }
        );

    /*
     * Los filtros solamente deben mostrar
     * turnos que se encuentren activos.
     */
    const turnos =
      await prisma.turno.findMany(
        {
          where: {
            estado: true,
          },

          select: {
            id: true,
            nombre: true,
            horaEntrada: true,
            horaSalida: true,
            estado: true,
          },

          orderBy: {
            id: "asc",
          },
        }
      );

    return NextResponse.json({
      ok: true,
      fecha,

      diaNoLectivo:
        eventosNoLectivos.length >
        0,

      diaNoLectivoGeneral,

      total:
        ausentes.length,

      alertasEnviadas:
        ausentes.filter(
          (estudiante) =>
            estudiante
              .alertaEnviada
        ).length,

      alertasPendientes:
        ausentes.filter(
          (estudiante) =>
            !estudiante
              .alertaEnviada
        ).length,

      turnos,
      ausentes,
    });
  } catch (error) {
    console.error(
      "Error obteniendo estudiantes ausentes:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo obtener el reporte de ausentes",
      },
      {
        status: 500,
      }
    );
  }
}