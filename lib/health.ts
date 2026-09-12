import { prisma } from "./prisma";
import { obtenerEstadoSuperMotor, normalizarColegioId } from "./supermotor";
import { horaPeru, fechaPeru } from "./timezone";

export type ServicioSalud =
  | "DATABASE"
  | "SUPERMOTOR"
  | "CRON"
  | "TELEGRAM"
  | "WHATSAPP"
  | "STORAGE";

export type EstadoSalud = "OK" | "WARNING" | "ERROR";

export interface EventoSaludInput {
  servicio: ServicioSalud;
  estado: EstadoSalud;
  mensaje: string;
  tiempoRespuesta?: number;
  detalles?: any;
  colegioId?: string;
}

export interface AlertaSistema {
  id: string;
  nivel: "CRITICA" | "ADVERTENCIA" | "INFO";
  servicio: ServicioSalud;
  mensaje: string;
  timestamp: string;
}

/**
 * FASE 13.2: Registrar evento en el registro histórico de salud del sistema.
 */
export async function registrarEventoSalud(input: EventoSaludInput) {
  const colegioId = normalizarColegioId(input.colegioId);
  const tiempoRespuesta = typeof input.tiempoRespuesta === "number" ? Math.max(0, input.tiempoRespuesta) : 0;
  const detallesStr =
    typeof input.detalles === "string"
      ? input.detalles
      : input.detalles
      ? JSON.stringify(input.detalles)
      : "";

  try {
    return await prisma.systemHealthLog.create({
      data: {
        colegioId,
        servicio: input.servicio,
        estado: input.estado,
        mensaje: input.mensaje || "",
        tiempoRespuesta,
        detalles: detallesStr,
      },
    });
  } catch (error) {
    console.warn("[HEALTH LOG] No se pudo guardar log de salud:", error);
    return null;
  }
}

/**
 * FASE 13.4: Evaluar alertas internas ante fallos consecutivos o anomalías.
 */
export async function evaluarAlertasInternas(colegioId: string): Promise<AlertaSistema[]> {
  const alertas: AlertaSistema[] = [];

  try {
    // 1. Validar si Cron ha fallado 3 veces consecutivas
    const ultimosCron = await prisma.systemHealthLog.findMany({
      where: {
        colegioId,
        servicio: "CRON",
      },
      orderBy: { id: "desc" },
      take: 3,
    });

    if (ultimosCron.length >= 3 && ultimosCron.every((l) => l.estado === "ERROR")) {
      alertas.push({
        id: `alt_cron_${Date.now()}`,
        nivel: "CRITICA",
        servicio: "CRON",
        mensaje: "El Cron Job de automatizaciones ha fallado 3 veces consecutivas.",
        timestamp: horaPeru(),
      });
    }

    // 2. Validar fallos recientes en Telegram
    const ultimoTelegram = await prisma.systemHealthLog.findFirst({
      where: {
        colegioId,
        servicio: "TELEGRAM",
      },
      orderBy: { id: "desc" },
    });

    if (ultimoTelegram && ultimoTelegram.estado === "ERROR") {
      alertas.push({
        id: `alt_tg_${Date.now()}`,
        nivel: "ADVERTENCIA",
        servicio: "TELEGRAM",
        mensaje: `Último envío de Telegram con error: ${ultimoTelegram.mensaje}`,
        timestamp: horaPeru(ultimoTelegram.fechaHora),
      });
    }

    // 3. Validar fallos recientes en Base de Datos
    const ultimoDB = await prisma.systemHealthLog.findFirst({
      where: {
        colegioId,
        servicio: "DATABASE",
      },
      orderBy: { id: "desc" },
    });

    if (ultimoDB && ultimoDB.estado === "ERROR") {
      alertas.push({
        id: `alt_db_${Date.now()}`,
        nivel: "CRITICA",
        servicio: "DATABASE",
        mensaje: `Error de conectividad en base de datos: ${ultimoDB.mensaje}`,
        timestamp: horaPeru(ultimoDB.fechaHora),
      });
    }
  } catch (err) {
    console.warn("[HEALTH ALERTS] Error evaluando alertas:", err);
  }

  return alertas;
}

/**
 * FASE 13.1 & 13.5: Diagnóstico completo y en tiempo real de todos los servicios.
 */
export async function obtenerDiagnosticoCompleto(colegioIdParam: string = "SANTA_RITA_001") {
  const colegioId = normalizarColegioId(colegioIdParam);
  const ahora = new Date();
  const horaActualStr = horaPeru(ahora);

  // 1. BASE DE DATOS (Neon PostgreSQL via Prisma)
  let dbEstado: EstadoSalud = "OK";
  let dbLatencia = 0;
  let dbMensaje = "Conexión activa y operativa";
  try {
    const t0 = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1;");
    dbLatencia = Date.now() - t0;
    if (dbLatencia > 2500) {
      dbEstado = "WARNING";
      dbMensaje = `Latencia elevada (${dbLatencia}ms)`;
    }
  } catch (error: any) {
    dbEstado = "ERROR";
    dbMensaje = error?.message || "Fallo en conexión a base de datos";
  }

  // 2. SUPERMOTOR
  const estadoMotor = await obtenerEstadoSuperMotor(colegioId);
  const motorStatus: EstadoSalud = estadoMotor.motorActivo ? "OK" : "WARNING";

  // 3. CRON JOB
  const ultimoCronLog = await prisma.systemHealthLog.findFirst({
    where: {
      colegioId,
      servicio: "CRON",
    },
    orderBy: { id: "desc" },
  });

  const cronEstado: EstadoSalud = ultimoCronLog
    ? (ultimoCronLog.estado as EstadoSalud)
    : "OK";

  // 4. TELEGRAM
  const telegramConfigurado = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const ultimoTelegramLog = await prisma.systemHealthLog.findFirst({
    where: {
      colegioId,
      servicio: "TELEGRAM",
    },
    orderBy: { id: "desc" },
  });

  const telegramEstado: EstadoSalud = !telegramConfigurado
    ? "WARNING"
    : ultimoTelegramLog && ultimoTelegramLog.estado === "ERROR"
    ? "ERROR"
    : "OK";

  // 5. WHATSAPP
  const whatsappHabilitado = process.env.WHATSAPP_ENABLED === "true";
  const whatsappConfigurado = Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const ultimoWhatsAppLog = await prisma.systemHealthLog.findFirst({
    where: {
      colegioId,
      servicio: "WHATSAPP",
    },
    orderBy: { id: "desc" },
  });

  const whatsappEstado: EstadoSalud = !whatsappHabilitado
    ? "WARNING"
    : !whatsappConfigurado
    ? "WARNING"
    : ultimoWhatsAppLog && ultimoWhatsAppLog.estado === "ERROR"
    ? "ERROR"
    : "OK";

  // 6. VERCEL BLOB / STORAGE FOTOS
  const blobConfigurado = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const ultimaFoto = await prisma.asistencia.findFirst({
    where: {
      colegioId,
      fotoUrl: { not: null },
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      fecha: true,
      fotoUrl: true,
    },
  });

  const storageEstado: EstadoSalud = blobConfigurado ? "OK" : "WARNING";

  // 7. HISTORIAL RECIENTE
  const historialEventos = await prisma.systemHealthLog.findMany({
    where: { colegioId },
    orderBy: { id: "desc" },
    take: 15,
  });

  // 8. ALERTAS ACTIVAS
  const alertas = await evaluarAlertasInternas(colegioId);

  // Estado global del sistema
  const hayErrores = [
    dbEstado,
    cronEstado,
    telegramEstado,
    whatsappEstado,
    storageEstado,
  ].some((e) => e === "ERROR");

  const sistemaGeneral: EstadoSalud = hayErrores
    ? "ERROR"
    : !estadoMotor.motorActivo
    ? "WARNING"
    : "OK";

  return {
    sistema: sistemaGeneral === "OK" ? "OK" : sistemaGeneral === "WARNING" ? "ADVERTENCIA" : "ERROR",
    colegioId,
    timestamp: horaActualStr,
    fecha: fechaPeru(ahora),
    servicios: {
      database: {
        nombre: "Base de Datos PostgreSQL (Neon)",
        estado: dbEstado,
        tiempoRespuesta: dbLatencia,
        mensaje: dbMensaje,
        conexionPrisma: "Activa (Connection Pooler)",
        ultimaConsulta: horaActualStr,
      },
      supermotor: {
        nombre: "SuperMotor Escolar Inteligente",
        estado: motorStatus,
        motorActivo: estadoMotor.motorActivo,
        estadoJornada: estadoMotor.estadoJornada,
        modoOperacion: (estadoMotor as any).modoOperacion || "MANUAL",
        ultimaActivacion: estadoMotor.ultimaActivacion
          ? horaPeru(estadoMotor.ultimaActivacion)
          : "Sin registro",
        ultimoUsuario: estadoMotor.ultimoUsuario || "SISTEMA",
      },
      cron: {
        nombre: "Cron Job Automatizaciones (/api/cron/automatizaciones)",
        estado: cronEstado,
        ultimaEjecucion: ultimoCronLog
          ? horaPeru(ultimoCronLog.fechaHora)
          : "Pendiente",
        tiempoEjecucion: ultimoCronLog?.tiempoRespuesta
          ? `${ultimoCronLog.tiempoRespuesta}ms`
          : "N/A",
        resultado: ultimoCronLog?.estado || "OK",
        ultimoError:
          ultimoCronLog?.estado === "ERROR"
            ? ultimoCronLog.mensaje
            : "Ninguno",
      },
      telegram: {
        nombre: "Canal Telegram Bot",
        estado: telegramEstado,
        configurado: telegramConfigurado,
        ultimoMensaje: ultimoTelegramLog
          ? horaPeru(ultimoTelegramLog.fechaHora)
          : "N/A",
        ultimoError:
          ultimoTelegramLog?.estado === "ERROR"
            ? ultimoTelegramLog.mensaje
            : "Ninguno",
      },
      whatsapp: {
        nombre: "Canal WhatsApp Business Cloud API",
        estado: whatsappEstado,
        habilitado: whatsappHabilitado,
        configurado: whatsappConfigurado,
        ultimoEnvio: ultimoWhatsAppLog
          ? horaPeru(ultimoWhatsAppLog.fechaHora)
          : "N/A",
        ultimoError:
          ultimoWhatsAppLog?.estado === "ERROR"
            ? ultimoWhatsAppLog.mensaje
            : "Ninguno",
      },
      storage: {
        nombre: "Almacenamiento Vercel Blob (Evidencias)",
        estado: storageEstado,
        configurado: blobConfigurado,
        ultimaSubida: ultimaFoto?.fecha
          ? horaPeru(ultimaFoto.fecha)
          : "Sin evidencias registradas",
        ultimoRegistro: ultimaFoto
          ? "Evidencia procesada"
          : "N/A",
      },
    },
    alertas,
    historialEventos,
  };
}
