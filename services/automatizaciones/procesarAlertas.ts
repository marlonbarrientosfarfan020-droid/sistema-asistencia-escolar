import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/telegram";

import {
  ahoraPeru,
  fechaCalendarioBD,
  fechaHoraTurno,
  fechaPeru,
  limitesDiaPeru,
  sumarMinutos,
} from "./relojEscolar";

import {
  mensajeAusenciaConfirmada,
  mensajeIngresoPendiente,
  mensajeTardanza,
} from "./mensajesAlerta";

const MAXIMO_ALERTAS_MODO_PRUEBA = 5;

type TipoAlerta =
  | "INGRESO_PENDIENTE"
  | "ALERTA_TARDANZA"
  | "AUSENCIA_CONFIRMADA";

type DetalleEjecucion = {
  estudiante: string;
  turno: string;
  tipo: string;
  estado: string;
};

async function obtenerConfiguracion() {
  let configuracion =
    await prisma.configuracion.findFirst({
      orderBy: {
        id: "asc",
      },
    });

  if (!configuracion) {
    configuracion =
      await prisma.configuracion.create({
        data: {},
      });
  }

  return configuracion;
}

async function obtenerEventoNoLectivo(
  turnoId: number | null
) {
  const fechaHoyBD = fechaCalendarioBD();

  return prisma.calendarioEscolar.findFirst({
    where: {
      estado: true,

      fechaInicio: {
        lte: fechaHoyBD,
      },

      fechaFin: {
        gte: fechaHoyBD,
      },

      OR: [
        {
          todosLosTurnos: true,
        },
        {
          todosLosTurnos: false,
          turnoId,
        },
      ],
    },

    select: {
      id: true,
      descripcion: true,
      todosLosTurnos: true,
      turnoId: true,
    },
  });
}

async function alertaYaRegistrada(
  estudianteId: number,
  fecha: string,
  tipos: string[]
) {
  const alerta =
    await prisma.alertaAsistencia.findFirst({
      where: {
        estudianteId,
        fecha,

        tipo: {
          in: tipos,
        },
      },

      select: {
        id: true,
      },
    });

  return Boolean(alerta);
}

async function enviarYGuardarAlerta({
  estudianteId,
  chatId,
  fecha,
  tipo,
  mensaje,
  tiposEquivalentes = [],
}: {
  estudianteId: number;
  chatId: string;
  fecha: string;
  tipo: TipoAlerta;
  mensaje: string;
  tiposEquivalentes?: string[];
}) {
  const registrada =
    await alertaYaRegistrada(
      estudianteId,
      fecha,
      [tipo, ...tiposEquivalentes]
    );

  if (registrada) {
    return {
      enviada: false,
      estado: "Alerta ya enviada",
    };
  }

  const enviado = await enviarTelegram(
    chatId,
    mensaje
  );

  if (!enviado) {
    return {
      enviada: false,
      estado: "No se pudo enviar Telegram",
    };
  }

  await prisma.alertaAsistencia.create({
    data: {
      estudianteId,
      fecha,
      tipo,
    },
  });

  return {
    enviada: true,
    estado: "Alerta enviada",
  };
}

export async function procesarAlertasAsistencia() {
  const configuracion =
    await obtenerConfiguracion();

  const resumenVacio = {
    totalEstudiantes: 0,
    alertasInicialesEnviadas: 0,
    alertasTardanzaEnviadas: 0,
    ausenciasConfirmadasEnviadas: 0,
    erroresEnvio: 0,
  };

  /*
   * INTERRUPTOR PRINCIPAL
   *
   * El cron puede seguir llamando a la API,
   * pero no se procesará ninguna alerta si
   * el motor está apagado.
   */
  if (
    !configuracion.automatizacionesActivas
  ) {
    return {
      ok: true,
      ejecutado: false,

      message:
        "Las automatizaciones están desactivadas",

      resumen: resumenVacio,

      alertasInicialesEnviadas: 0,
      alertasTardanzaEnviadas: 0,
      ausenciasConfirmadasEnviadas: 0,
      erroresEnvio: 0,

      diaNoLectivo: false,
      detalle: [],
    };
  }

  /*
   * VALIDACIÓN DEL MODO PRUEBA
   */
  if (
    configuracion.modoPruebaAlertas &&
    !configuracion.telegramPruebaChatId.trim()
  ) {
    return {
      ok: false,
      ejecutado: false,

      message:
        "Modo prueba activo, pero no existe un Telegram Chat ID de prueba",

      resumen: resumenVacio,

      alertasInicialesEnviadas: 0,
      alertasTardanzaEnviadas: 0,
      ausenciasConfirmadasEnviadas: 0,
      erroresEnvio: 1,

      diaNoLectivo: false,
      detalle: [],
    };
  }

  const hoy = fechaPeru();
  const ahora = ahoraPeru();

  const {
    inicioDia,
    finDia,
  } = limitesDiaPeru();

  const estudiantes =
    await prisma.estudiante.findMany({
      where: {
        estado: true,
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
          },
        },
      },

      orderBy: [
        {
          turnoId: "asc",
        },
        {
          apellidos: "asc",
        },
        {
          nombres: "asc",
        },
      ],
    });

  let alertasInicialesEnviadas = 0;
  let alertasTardanzaEnviadas = 0;
  let ausenciasConfirmadasEnviadas = 0;
  let erroresEnvio = 0;
  let alertasModoPrueba = 0;

  const detalle: DetalleEjecucion[] = [];

  for (const estudiante of estudiantes) {
    const nombreCompleto =
      `${estudiante.nombres} ${estudiante.apellidos}`;

    /*
     * ESTUDIANTE SIN TURNO
     */
    if (!estudiante.turno) {
      detalle.push({
        estudiante: nombreCompleto,
        turno: "Sin turno",
        tipo: "NINGUNA",
        estado: "Sin turno asignado",
      });

      continue;
    }

    const turno = estudiante.turno;

    /*
     * TURNO INACTIVO
     *
     * Aunque el estudiante esté activo, no se
     * envían alertas si su turno está desactivado.
     */
    if (!turno.estado) {
      detalle.push({
        estudiante: nombreCompleto,
        turno: turno.nombre,
        tipo: "NINGUNA",
        estado: "Turno inactivo",
      });

      continue;
    }

    /*
     * DÍA NO LECTIVO
     */
    const eventoNoLectivo =
      await obtenerEventoNoLectivo(
        estudiante.turnoId
      );

    if (eventoNoLectivo) {
      detalle.push({
        estudiante: nombreCompleto,
        turno: turno.nombre,
        tipo: "NINGUNA",

        estado:
          `Día no lectivo: ${eventoNoLectivo.descripcion}`,
      });

      continue;
    }

    /*
     * SI YA MARCÓ ENTRADA, NO DEBE RECIBIR
     * NINGUNA ALERTA PENDIENTE.
     */
    const yaMarcoEntrada =
      estudiante.asistencias.some(
        (asistencia) =>
          asistencia.horaEntrada !== null
      );

    if (yaMarcoEntrada) {
      detalle.push({
        estudiante: nombreCompleto,
        turno: turno.nombre,
        tipo: "NINGUNA",
        estado: "Ya marcó asistencia",
      });

      continue;
    }

    /*
     * DESTINO DEL MENSAJE
     *
     * Modo prueba:
     *   Telegram del administrador.
     *
     * Modo real:
     *   Telegram del tutor del estudiante.
     */
    const chatIdDestino =
      configuracion.modoPruebaAlertas
        ? configuracion.telegramPruebaChatId.trim()
        : estudiante.telegramChatId.trim();

    if (!chatIdDestino) {
      detalle.push({
        estudiante: nombreCompleto,
        turno: turno.nombre,
        tipo: "NINGUNA",

        estado:
          "El tutor no tiene Telegram Chat ID",
      });

      continue;
    }

    /*
     * PROTECCIÓN DEL MODO PRUEBA
     *
     * Se envían como máximo cinco mensajes
     * nuevos por cada ejecución manual o del cron.
     */
    if (
      configuracion.modoPruebaAlertas &&
      alertasModoPrueba >=
        MAXIMO_ALERTAS_MODO_PRUEBA
    ) {
      detalle.push({
        estudiante: nombreCompleto,
        turno: turno.nombre,
        tipo: "NINGUNA",

        estado:
          "Omitida por límite del modo prueba",
      });

      continue;
    }

    /*
     * HORARIOS DEL TURNO
     */
    const horaEntrada =
      fechaHoraTurno(
        turno.horaEntrada
      );

    const horaSalida =
      fechaHoraTurno(
        turno.horaSalida
      );

    /*
     * ALERTA 1:
     * Hora de entrada + aviso inicial del turno.
     */
    const limiteInicial =
      sumarMinutos(
        horaEntrada,
        turno.minutosAlertaInicial
      );

    /*
     * ALERTA 2:
     * Hora de entrada + margen de tardanza.
     */
    const limiteTardanza =
      sumarMinutos(
        horaEntrada,
        turno.margenAlertaMinutos
      );

    let tipo: TipoAlerta | null = null;
    let mensaje = "";
    let tiposEquivalentes: string[] = [];
    let etapaActual = "";

    /*
     * ETAPA 3: AUSENCIA CONFIRMADA
     *
     * Tiene prioridad cuando ya finalizó el turno.
     * Si esta alerta está desactivada, no se debe
     * retroceder y mandar una tardanza.
     */
    if (ahora >= horaSalida) {
      etapaActual = "AUSENCIA_CONFIRMADA";

      if (
        configuracion.alertaAusenciaActiva
      ) {
        tipo = "AUSENCIA_CONFIRMADA";

        mensaje =
          mensajeAusenciaConfirmada({
            ...estudiante,
            turno,
          });
      }
    }

    /*
     * ETAPA 2: ALERTA DE TARDANZA
     *
     * Solamente se evalúa antes de finalizar
     * el turno.
     */
    else if (ahora >= limiteTardanza) {
      etapaActual = "ALERTA_TARDANZA";

      if (
        configuracion.alertaTardanzaActiva
      ) {
        tipo = "ALERTA_TARDANZA";

        tiposEquivalentes = [
          "AUSENCIA_ENTRADA",
        ];

        mensaje = mensajeTardanza({
          ...estudiante,
          turno,
        });
      }
    }

    /*
     * ETAPA 1: INGRESO PENDIENTE
     *
     * Se ejecuta después de los minutos de aviso
     * inicial y antes del margen de tardanza.
     */
    else if (ahora >= limiteInicial) {
      etapaActual = "INGRESO_PENDIENTE";

      if (
        configuracion
          .alertaIngresoPendienteActiva
      ) {
        tipo = "INGRESO_PENDIENTE";

        mensaje =
          mensajeIngresoPendiente({
            ...estudiante,
            turno,
          });
      }
    }

    /*
     * TODAVÍA NO LLEGÓ EL MOMENTO DEL
     * AVISO INICIAL.
     */
    else {
      etapaActual =
        "ANTES_DEL_AVISO_INICIAL";
    }

    /*
     * SI LA ETAPA CORRESPONDE, PERO ESA ALERTA
     * ESTÁ DESACTIVADA, NO SE ENVÍA OTRA ALERTA
     * ANTERIOR.
     */
    if (!tipo) {
      const estado =
        etapaActual ===
        "ANTES_DEL_AVISO_INICIAL"
          ? "Aún no corresponde enviar alerta"
          : `La alerta ${etapaActual} está desactivada`;

      detalle.push({
        estudiante: nombreCompleto,
        turno: turno.nombre,
        tipo: etapaActual,
        estado,
      });

      continue;
    }

    /*
     * ENVÍO Y REGISTRO
     */
    const resultado =
      await enviarYGuardarAlerta({
        estudianteId: estudiante.id,
        chatId: chatIdDestino,
        fecha: hoy,
        tipo,
        mensaje,
        tiposEquivalentes,
      });

    if (
      resultado.enviada &&
      configuracion.modoPruebaAlertas
    ) {
      alertasModoPrueba++;
    }

    if (
      resultado.estado ===
      "No se pudo enviar Telegram"
    ) {
      erroresEnvio++;
    }

    if (resultado.enviada) {
      if (
        tipo === "INGRESO_PENDIENTE"
      ) {
        alertasInicialesEnviadas++;
      }

      if (
        tipo === "ALERTA_TARDANZA"
      ) {
        alertasTardanzaEnviadas++;
      }

      if (
        tipo === "AUSENCIA_CONFIRMADA"
      ) {
        ausenciasConfirmadasEnviadas++;
      }
    }

    detalle.push({
      estudiante: nombreCompleto,
      turno: turno.nombre,
      tipo,
      estado: resultado.estado,
    });
  }

  const resumen = {
    totalEstudiantes: estudiantes.length,
    alertasInicialesEnviadas,
    alertasTardanzaEnviadas,
    ausenciasConfirmadasEnviadas,
    erroresEnvio,
  };

  const estadoFinal =
    `Iniciales: ${alertasInicialesEnviadas} | ` +
    `Tardanzas: ${alertasTardanzaEnviadas} | ` +
    `Ausencias: ${ausenciasConfirmadasEnviadas} | ` +
    `Errores: ${erroresEnvio}`;

  /*
   * GUARDAR ESTADO DE LA EJECUCIÓN
   */
  await prisma.configuracion.update({
    where: {
      id: configuracion.id,
    },

    data: {
      ultimaEjecucionAutomatizaciones:
        new Date(),

      ultimaEjecucionEstado:
        estadoFinal,
    },
  });

  return {
    ok: true,
    ejecutado: true,

    message:
      "Revisión de automatizaciones finalizada",

    resumen,

    alertasInicialesEnviadas,
    alertasTardanzaEnviadas,
    ausenciasConfirmadasEnviadas,
    erroresEnvio,

    modoPrueba:
      configuracion.modoPruebaAlertas,

    limiteModoPrueba:
      configuracion.modoPruebaAlertas
        ? MAXIMO_ALERTAS_MODO_PRUEBA
        : null,

    diaNoLectivo: detalle.some(
      (item) =>
        item.estado.startsWith(
          "Día no lectivo:"
        )
    ),

    detalle,
  };
}