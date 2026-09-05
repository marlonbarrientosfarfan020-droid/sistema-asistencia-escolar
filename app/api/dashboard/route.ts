import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDirectivoODemo } from "@/lib/auth";
import {
  fechaPeru,
  ahoraPeru,
  crearFechaHoraPeru,
  obtenerLimitesDiaPeru,
  obtenerVentanaTurno,
  ZONA_HORARIA,
} from "@/lib/timezone";

type EstadoOperativo =
  | "PENDIENTE_INICIO"
  | "ESPERANDO_INGRESO"
  | "INGRESO_PENDIENTE"
  | "TARDANZA_SIN_INGRESO"
  | "PUNTUAL"
  | "TARDE"
  | "AUSENTE_CONFIRMADO"
  | "NO_LECTIVO"
  | "SIN_TURNO"
  | "TURNO_INACTIVO";

type ResumenBase = {
  total: number;
  presentes: number;
  puntuales: number;
  tardanzas: number;
  pendientesInicio: number;
  esperandoIngreso: number;
  ingresoPendiente: number;
  tardanzaSinIngreso: number;
  ausentesConfirmados: number;
  sinSalida: number;
  alertasIngresoPendiente: number;
  alertasTardanza: number;
  alertasAusencia: number;
  alertasEnviadas: number;
};

function fechaHoraTurno(
  fecha: string,
  hora: string
) {
  return crearFechaHoraPeru(fecha, hora);
}

function sumarMinutos(
  fecha: Date,
  minutos: number
) {
  const resultado = new Date(fecha);

  resultado.setMinutes(
    resultado.getMinutes() +
      Math.max(Number(minutos) || 0, 0)
  );

  return resultado;
}

function nombreDiaCorto(fechaISO: string) {
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    timeZone: ZONA_HORARIA,
  })
    .format(
      new Date(
        `${fechaISO}T12:00:00.000-05:00`
      )
    )
    .replace(".", "")
    .toUpperCase();
}

function crearResumenVacio(): ResumenBase {
  return {
    total: 0,
    presentes: 0,
    puntuales: 0,
    tardanzas: 0,
    pendientesInicio: 0,
    esperandoIngreso: 0,
    ingresoPendiente: 0,
    tardanzaSinIngreso: 0,
    ausentesConfirmados: 0,
    sinSalida: 0,
    alertasIngresoPendiente: 0,
    alertasTardanza: 0,
    alertasAusencia: 0,
    alertasEnviadas: 0,
  };
}

function sumarEstado(
  resumen: ResumenBase,
  estado: EstadoOperativo
) {
  resumen.total++;

  if (estado === "PUNTUAL") {
    resumen.presentes++;
    resumen.puntuales++;
  }

  if (estado === "TARDE") {
    resumen.presentes++;
    resumen.tardanzas++;
  }

  if (estado === "PENDIENTE_INICIO") {
    resumen.pendientesInicio++;
  }

  if (estado === "ESPERANDO_INGRESO") {
    resumen.esperandoIngreso++;
  }

  if (estado === "INGRESO_PENDIENTE") {
    resumen.ingresoPendiente++;
  }

  if (estado === "TARDANZA_SIN_INGRESO") {
    resumen.tardanzaSinIngreso++;
  }

  if (estado === "AUSENTE_CONFIRMADO") {
    resumen.ausentesConfirmados++;
  }
}

function sumarAlerta(
  resumen: ResumenBase,
  tipo: string
) {
  if (tipo === "INGRESO_PENDIENTE") {
    resumen.alertasIngresoPendiente++;
  }

  if (
    tipo === "ALERTA_TARDANZA" ||
    tipo === "AUSENCIA_ENTRADA"
  ) {
    resumen.alertasTardanza++;
  }

  if (tipo === "AUSENCIA_CONFIRMADA") {
    resumen.alertasAusencia++;
  }

  resumen.alertasEnviadas++;
}

export async function GET() {
  const acceso =
    await exigirAdminDirectivoODemo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const hoy = fechaPeru();
    const ahora = ahoraPeru();
    const { inicioDia, finDia } = obtenerLimitesDiaPeru(hoy);
    const fechaHoyBD = new Date(`${hoy}T00:00:00.000Z`);

    const [
      configuracion,
      estudiantes,
      asistenciasRegistradas,
      alertasHoy,
      eventosNoLectivosHoy,
      ultimoAnalisisIA,
      topRiesgoIA,
      riesgoAlto,
      riesgoMedio,
      riesgoBajo,
    ] = await Promise.all([
      prisma.configuracion.findFirst({
        orderBy: {
          id: "asc",
        },
      }),

      prisma.estudiante.findMany({
        where: {
          estado: true,
        },

        include: {
          turno: true,
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
      }),

      prisma.asistencia.findMany({
        where: {
          OR: [
            { fechaDia: hoy },
            {
              fecha: {
                gte: inicioDia,
                lte: finDia,
              },
            },
          ],
        },

        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },

        orderBy: {
          fecha: "desc",
        },
      }),

      prisma.alertaAsistencia.findMany({
        where: {
          fecha: hoy,
        },

        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.calendarioEscolar.findMany({
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

        orderBy: {
          id: "asc",
        },
      }),

      prisma.analisisIA.findFirst({
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.riesgoEstudianteIA.findMany({
        where: {
          estudiante: {
            estado: true,
          },
          porcentaje: {
            gt: 0,
          },
        },

        take: 8,

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
      }),

      prisma.riesgoEstudianteIA.count({
        where: {
          nivel: "ALTO",
          estudiante: {
            estado: true,
          },
        },
      }),

      prisma.riesgoEstudianteIA.count({
        where: {
          nivel: "MEDIO",
          estudiante: {
            estado: true,
          },
        },
      }),

      prisma.riesgoEstudianteIA.count({
        where: {
          nivel: "BAJO",
          estudiante: {
            estado: true,
          },
        },
      }),
    ]);

    /*
     * Una asistencia real por estudiante.
     * Si por alguna razón existen varios registros,
     * se prioriza uno que tenga hora de entrada.
     */
    const asistenciaPorEstudiante =
      new Map<
        number,
        (typeof asistenciasRegistradas)[number]
      >();

    for (const asistencia of asistenciasRegistradas) {
      const actual =
        asistenciaPorEstudiante.get(
          asistencia.estudianteId
        );

      if (
        !actual ||
        (!actual.horaEntrada &&
          asistencia.horaEntrada)
      ) {
        asistenciaPorEstudiante.set(
          asistencia.estudianteId,
          asistencia
        );
      }
    }

    const alertasPorEstudiante =
      new Map<
        number,
        (typeof alertasHoy)[number][]
      >();

    for (const alerta of alertasHoy) {
      const lista =
        alertasPorEstudiante.get(
          alerta.estudianteId
        ) || [];

      lista.push(alerta);

      alertasPorEstudiante.set(
        alerta.estudianteId,
        lista
      );
    }

    function eventoNoLectivoTurno(
      turnoId: number | null
    ) {
      return eventosNoLectivosHoy.find(
        (evento) =>
          evento.todosLosTurnos ||
          (!evento.todosLosTurnos &&
            evento.turnoId === turnoId)
      );
    }

    function calcularEstado(
      estudiante: (typeof estudiantes)[number]
    ): EstadoOperativo {
      const turno = estudiante.turno;

      if (!turno) {
        return "SIN_TURNO";
      }

      if (!turno.estado) {
        return "TURNO_INACTIVO";
      }

      if (
        eventoNoLectivoTurno(
          estudiante.turnoId
        )
      ) {
        return "NO_LECTIVO";
      }

      const asistencia =
        asistenciaPorEstudiante.get(
          estudiante.id
        );

      if (asistencia?.horaEntrada) {
        return asistencia.estado === "TARDE"
          ? "TARDE"
          : "PUNTUAL";
      }

      const horaEntrada =
        fechaHoraTurno(
          hoy,
          turno.horaEntrada
        );

      const limiteAviso =
        sumarMinutos(
          horaEntrada,
          turno.minutosAlertaInicial
        );

      const limiteTardanza =
        sumarMinutos(
          horaEntrada,
          turno.margenAlertaMinutos
        );

      const horaSalida =
        fechaHoraTurno(
          hoy,
          turno.horaSalida
        );

      if (ahora < horaEntrada) {
        return "PENDIENTE_INICIO";
      }

      if (ahora < limiteAviso) {
        return "ESPERANDO_INGRESO";
      }

      if (ahora < limiteTardanza) {
        return "INGRESO_PENDIENTE";
      }

      if (ahora < horaSalida) {
        return "TARDANZA_SIN_INGRESO";
      }

      return "AUSENTE_CONFIRMADO";
    }

    const resumenGeneral =
      crearResumenVacio();

    const resumenTurnosMap = new Map<
      number,
      {
        id: number;
        nombre: string;
        horaEntrada: string;
        horaSalida: string;
        minutosAlertaInicial: number;
        margenAlertaMinutos: number;
        activo: boolean;
        noLectivo: boolean;
        motivoNoLectivo: string;
        resumen: ResumenBase;
        seccionesMap: Map<
          string,
          {
            grado: string;
            seccion: string;
            resumen: ResumenBase;
          }
        >;
      }
    >();

    for (const estudiante of estudiantes) {
      const turno = estudiante.turno;

      if (!turno) {
        continue;
      }

      if (!resumenTurnosMap.has(turno.id)) {
        const evento =
          eventoNoLectivoTurno(turno.id);

        resumenTurnosMap.set(turno.id, {
          id: turno.id,
          nombre: turno.nombre,
          horaEntrada: turno.horaEntrada,
          horaSalida: turno.horaSalida,
          minutosAlertaInicial:
            turno.minutosAlertaInicial,
          margenAlertaMinutos:
            turno.margenAlertaMinutos,
          activo: turno.estado,
          noLectivo: Boolean(evento),
          motivoNoLectivo:
            evento?.descripcion || "",
          resumen: crearResumenVacio(),
          seccionesMap: new Map(),
        });
      }

      const resumenTurno =
        resumenTurnosMap.get(turno.id)!;

      const claveSeccion =
        `${estudiante.grado}__${estudiante.seccion}`;

      if (
        !resumenTurno.seccionesMap.has(
          claveSeccion
        )
      ) {
        resumenTurno.seccionesMap.set(
          claveSeccion,
          {
            grado: estudiante.grado,
            seccion: estudiante.seccion,
            resumen: crearResumenVacio(),
          }
        );
      }

      const seccion =
        resumenTurno.seccionesMap.get(
          claveSeccion
        )!;

      const estado =
        calcularEstado(estudiante);

      if (
        estado !== "NO_LECTIVO" &&
        estado !== "SIN_TURNO" &&
        estado !== "TURNO_INACTIVO"
      ) {
        sumarEstado(
          resumenGeneral,
          estado
        );

        sumarEstado(
          resumenTurno.resumen,
          estado
        );

        sumarEstado(
          seccion.resumen,
          estado
        );
      }

      const alertasEstudiante =
        alertasPorEstudiante.get(
          estudiante.id
        ) || [];

      for (const alerta of alertasEstudiante) {
        sumarAlerta(
          resumenGeneral,
          alerta.tipo
        );

        sumarAlerta(
          resumenTurno.resumen,
          alerta.tipo
        );

        sumarAlerta(
          seccion.resumen,
          alerta.tipo
        );
      }
    }

    /*
     * Sin salida se calcula únicamente
     * sobre asistencias reales.
     */
    for (const asistencia of asistenciaPorEstudiante.values()) {
      if (
        asistencia.horaEntrada &&
        !asistencia.horaSalida
      ) {
        resumenGeneral.sinSalida++;

        const turnoId =
          asistencia.estudiante.turnoId;

        if (turnoId) {
          const turno =
            resumenTurnosMap.get(turnoId);

          if (turno) {
            turno.resumen.sinSalida++;

            const clave =
              `${asistencia.estudiante.grado}__${asistencia.estudiante.seccion}`;

            const seccion =
              turno.seccionesMap.get(clave);

            if (seccion) {
              seccion.resumen.sinSalida++;
            }
          }
        }
      }
    }

    const resumenTurnos =
      Array.from(
        resumenTurnosMap.values()
      )
        .sort((a, b) => a.id - b.id)
        .map((turno) => ({
          id: turno.id,
          nombre: turno.nombre,
          horaEntrada: turno.horaEntrada,
          horaSalida: turno.horaSalida,
          minutosAlertaInicial:
            turno.minutosAlertaInicial,
          margenAlertaMinutos:
            turno.margenAlertaMinutos,
          activo: turno.activo,
          noLectivo: turno.noLectivo,
          motivoNoLectivo:
            turno.motivoNoLectivo,

          ...turno.resumen,

          /*
           * Compatibilidad con el dashboard anterior.
           */
          ausentes:
            turno.resumen
              .ausentesConfirmados,

          secciones: Array.from(
            turno.seccionesMap.values()
          )
            .sort((a, b) => {
              const grado =
                a.grado.localeCompare(
                  b.grado,
                  "es",
                  {
                    numeric: true,
                  }
                );

              if (grado !== 0) {
                return grado;
              }

              return a.seccion.localeCompare(
                b.seccion,
                "es"
              );
            })
            .map((seccion) => ({
              grado: seccion.grado,
              seccion: seccion.seccion,
              ...seccion.resumen,
              ausentes:
                seccion.resumen
                  .ausentesConfirmados,
            })),
        }));

    /*
     * Resumen completamente dinámico por grado.
     * Se crea desde los estudiantes activos existentes:
     * si mañana aparece un grado o sección nueva,
     * se incorpora automáticamente.
     */
    const resumenGradosMap = new Map<
      string,
      ResumenBase & {
        grado: string;
        turnos: Set<string>;
        secciones: Set<string>;
      }
    >();

    for (const turno of resumenTurnos) {
      for (const seccion of turno.secciones) {
        const actual =
          resumenGradosMap.get(
            seccion.grado
          ) || {
            grado: seccion.grado,
            turnos: new Set<string>(),
            secciones: new Set<string>(),
            ...crearResumenVacio(),
          };

        actual.turnos.add(
          turno.nombre
        );

        actual.secciones.add(
          seccion.seccion
        );

        actual.total += seccion.total;
        actual.presentes +=
          seccion.presentes;
        actual.puntuales +=
          seccion.puntuales;
        actual.tardanzas +=
          seccion.tardanzas;
        actual.pendientesInicio +=
          seccion.pendientesInicio;
        actual.esperandoIngreso +=
          seccion.esperandoIngreso;
        actual.ingresoPendiente +=
          seccion.ingresoPendiente;
        actual.tardanzaSinIngreso +=
          seccion.tardanzaSinIngreso;
        actual.ausentesConfirmados +=
          seccion.ausentesConfirmados;
        actual.sinSalida +=
          seccion.sinSalida;
        actual.alertasIngresoPendiente +=
          seccion.alertasIngresoPendiente;
        actual.alertasTardanza +=
          seccion.alertasTardanza;
        actual.alertasAusencia +=
          seccion.alertasAusencia;
        actual.alertasEnviadas +=
          seccion.alertasEnviadas;

        resumenGradosMap.set(
          seccion.grado,
          actual
        );
      }
    }

    const resumenGrados =
      Array.from(
        resumenGradosMap.values()
      )
        .sort((a, b) =>
          a.grado.localeCompare(
            b.grado,
            "es",
            {
              numeric: true,
            }
          )
        )
        .map((grado) => ({
          grado: grado.grado,
          turnos:
            Array.from(
              grado.turnos
            ).sort(),
          secciones:
            Array.from(
              grado.secciones
            ).sort((a, b) =>
              a.localeCompare(
                b,
                "es"
              )
            ),
          total: grado.total,
          presentes:
            grado.presentes,
          puntuales:
            grado.puntuales,
          tardanzas:
            grado.tardanzas,
          sinIngreso:
            grado.esperandoIngreso +
            grado.ingresoPendiente +
            grado.tardanzaSinIngreso,
          tardanzaSinIngreso:
            grado.tardanzaSinIngreso,
          ausentesConfirmados:
            grado.ausentesConfirmados,
          alertasEnviadas:
            grado.alertasEnviadas,
          porcentaje:
            grado.total > 0
              ? Math.round(
                  (grado.presentes /
                    grado.total) *
                    100
                )
              : 0,
        }));

    const catalogoDinamico = {
      turnos: resumenTurnos.map(
        (turno) => ({
          id: turno.id,
          nombre: turno.nombre,
        })
      ),

      grados:
        resumenGrados.map(
          (grado) => grado.grado
        ),

      secciones:
        Array.from(
          new Set(
            resumenTurnos.flatMap(
              (turno) =>
                turno.secciones.map(
                  (seccion) =>
                    seccion.seccion
                )
            )
          )
        ).sort((a, b) =>
          a.localeCompare(
            b,
            "es"
          )
        ),

      combinaciones:
        resumenTurnos.flatMap(
          (turno) =>
            turno.secciones.map(
              (seccion) => ({
                turnoId:
                  turno.id,
                turno:
                  turno.nombre,
                grado:
                  seccion.grado,
                seccion:
                  seccion.seccion,
                clave:
                  `${turno.id}__${seccion.grado}__${seccion.seccion}`,
              })
            )
        ),
    };

    const ultimasAsistencias =
      asistenciasRegistradas
        .slice(0, 8);

    const ultimasAlertas =
      alertasHoy
        .slice(0, 20)
        .map((alerta) => ({
          id: alerta.id,
          tipo: alerta.tipo,
          fecha: alerta.fecha,
          createdAt: alerta.createdAt,

          estudiante: {
            id: alerta.estudiante.id,
            codigo:
              alerta.estudiante.codigo,
            dni: alerta.estudiante.dni,
            nombres:
              alerta.estudiante.nombres,
            apellidos:
              alerta.estudiante.apellidos,
            grado:
              alerta.estudiante.grado,
            seccion:
              alerta.estudiante.seccion,
            tutor:
              alerta.estudiante
                .nombreTutor,
            telegramChatId:
              alerta.estudiante
                .telegramChatId,

            turno:
              alerta.estudiante.turno
                ? {
                    id:
                      alerta.estudiante
                        .turno.id,

                    nombre:
                      alerta.estudiante
                        .turno.nombre,
                  }
                : null,
          },
        }));

    const alertas = {
      ingresoPendiente:
        resumenGeneral
          .alertasIngresoPendiente,

      tardanza:
        resumenGeneral
          .alertasTardanza,

      ausencia:
        resumenGeneral
          .alertasAusencia,

      total:
        resumenGeneral.alertasEnviadas,
    };

    const totalEstudiantes =
      estudiantes.length;

    const presentes =
      resumenGeneral.presentes;

    const entradas =
      Array.from(
        asistenciaPorEstudiante.values()
      ).filter(
        (asistencia) =>
          asistencia.horaEntrada !== null
      ).length;

    const salidas =
      Array.from(
        asistenciaPorEstudiante.values()
      ).filter(
        (asistencia) =>
          asistencia.horaSalida !== null
      ).length;

    // Métricas del Modelo Profesional de Jornada Escolar (Requerimiento 5)
    const metricasEntrada = {
      puntuales: resumenGeneral.puntuales,
      tardanzas: resumenGeneral.tardanzas,
      sinIngreso: Math.max(totalEstudiantes - resumenGeneral.presentes, 0),
    };

    let salieron = 0;
    let pendientes = 0;
    let fueraHorario = 0;

    for (const asistencia of asistenciaPorEstudiante.values()) {
      if (asistencia.horaSalida) {
        if (asistencia.estadoSalida === "FUERA_HORARIO") {
          fueraHorario++;
        } else {
          salieron++;
        }
      } else if (asistencia.horaEntrada) {
        const turno = asistencia.estudiante.turno;
        if (turno) {
          const ventana = obtenerVentanaTurno({
            horaEntrada: turno.horaEntrada,
            horaSalida: turno.horaSalida,
            margenEntradaAnticipadaMinutos: turno.margenEntradaAnticipadaMinutos,
            margenSalidaMinutos: turno.margenSalidaMinutos,
            ahora,
          });
          if (ahora > ventana.finPermitido) {
            fueraHorario++;
          } else {
            pendientes++;
          }
        } else {
          pendientes++;
        }
      }
    }

    const metricasSalida = {
      salieron,
      pendientes,
      fueraHorario,
    };

    const metricasJornada = {
      entrada: metricasEntrada,
      salida: metricasSalida,
    };

    const textoIA =
      ultimoAnalisisIA?.resultado || "";

    const resumenIA =
      textoIA.length > 0
        ? textoIA.slice(0, 450) +
          (textoIA.length > 450
            ? "..."
            : "")
        : "La IA aún no ha generado un análisis. Ingrese al Centro de Inteligencia Escolar para ejecutar un análisis general o individual.";

    /*
     * Tendencia de los últimos siete días.
     * Conservamos el cálculo histórico anterior,
     * pero usando estudiantes únicos.
     */
    const fechaInicioTendencia =
      new Date(inicioDia);

    fechaInicioTendencia.setDate(
      fechaInicioTendencia.getDate() - 6
    );

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
        },
      });

    const tendenciaSemanal =
      Array.from(
        {
          length: 7,
        },
        (_, indice) => {
          const fecha =
            new Date(fechaInicioTendencia);

          fecha.setDate(
            fechaInicioTendencia.getDate() +
              indice
          );

          const fechaISO =
            fechaPeru(fecha);

          const registros =
            asistenciasUltimos7Dias.filter(
              (asistencia) =>
                fechaPeru(
                  asistencia.fecha
                ) === fechaISO
            );

          const idsPresentes =
            new Set(
              registros
                .filter(
                  (registro) =>
                    registro.estudianteId
                )
                .map(
                  (registro) =>
                    registro.estudianteId
                )
            );

          const puntualesDia =
            registros.filter(
              (registro) =>
                registro.estado ===
                "PUNTUAL"
            ).length;

          const tardanzasDia =
            registros.filter(
              (registro) =>
                registro.estado ===
                "TARDE"
            ).length;

          const presentesDia =
            idsPresentes.size;

          const ausentesDia =
            Math.max(
              totalEstudiantes -
                presentesDia,
              0
            );

          return {
            fecha: fechaISO,
            dia: nombreDiaCorto(
              fechaISO
            ),
            total:
              totalEstudiantes,
            presentes:
              presentesDia,
            ausentes:
              ausentesDia,
            puntuales:
              puntualesDia,
            tardanzas:
              tardanzasDia,
            porcentaje:
              totalEstudiantes > 0
                ? Math.round(
                    (presentesDia /
                      totalEstudiantes) *
                      100
                  )
                : 0,
          };
        }
      );

    return NextResponse.json({
      fecha: hoy,
      actualizadoEn: new Date(),

      totalEstudiantes,

      /*
       * Compatibilidad con tarjetas antiguas.
       */
      presentes,
      puntuales:
        resumenGeneral.puntuales,
      tardanzas:
        resumenGeneral.tardanzas,
      ausentes:
        resumenGeneral
          .ausentesConfirmados,
      entradas,
      salidas,
      sinSalida:
        resumenGeneral.sinSalida,

      /*
       * Estados reales del monitoreo.
       */
      pendientesInicio:
        resumenGeneral
          .pendientesInicio,

      esperandoIngreso:
        resumenGeneral
          .esperandoIngreso,

      ingresoPendiente:
        resumenGeneral
          .ingresoPendiente,

      tardanzaSinIngreso:
        resumenGeneral
          .tardanzaSinIngreso,

      ausentesConfirmados:
        resumenGeneral
          .ausentesConfirmados,

      sinIngreso:
        resumenGeneral
          .esperandoIngreso +
        resumenGeneral
          .ingresoPendiente +
        resumenGeneral
          .tardanzaSinIngreso,

      totalEsperadosHoy:
        resumenGeneral.total,

      alertas,

      resumenTurnos,
      resumenGrados,
      catalogoDinamico,
      ultimasAsistencias,
      ultimasAlertas,

      automatizaciones: {
        activas:
          configuracion
            ?.automatizacionesActivas ||
          false,

        modoPrueba:
          configuracion
            ?.modoPruebaAlertas ??
          true,

        ultimaEjecucion:
          configuracion
            ?.ultimaEjecucionAutomatizaciones ||
          null,

        ultimoEstado:
          configuracion
            ?.ultimaEjecucionEstado ||
          "",

        frecuenciaMinutos:
          configuracion
            ?.frecuenciaRevisionMinutos ||
          5,
      },

      diaNoLectivo:
        eventosNoLectivosHoy.length > 0,

      diaNoLectivoGeneral:
        eventosNoLectivosHoy.some(
          (evento) =>
            evento.todosLosTurnos
        ),

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

      riesgoAlto,
      riesgoMedio,
      riesgoBajo,
      resumenIA,
      topRiesgoIA,
      tendenciaSemanal,
      metricasJornada,
      metricasEntrada,
      metricasSalida,
    });
  } catch (error) {
    console.error(
      "Error obteniendo dashboard:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al obtener el Centro de Monitoreo Escolar",
      },
      {
        status: 500,
      }
    );
  }
}