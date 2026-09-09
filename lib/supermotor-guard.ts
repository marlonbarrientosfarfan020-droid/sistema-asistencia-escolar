import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  obtenerEstadoSuperMotor,
  normalizarModulo,
} from "@/lib/supermotor";
import { fechaPeru, horaPeru } from "@/lib/timezone";

export type ResultadoVerificacionMotor = {
  autorizado: boolean;
  motorActivo: boolean;
  estadoJornada: string;
  motivo?: "SUPERMOTOR_APAGADO";
  mensaje?: string;
};

export type ResultadoVerificacionModulo = {
  autorizado: boolean;
  modulo: string;
  campo: string;
  motivo?: "SUPERMOTOR_APAGADO" | "MODULO_DESACTIVADO" | "MODULO_INVALIDO";
  mensaje?: string;
  estado?: any;
};

/**
 * FASE 4.1: verificarMotorActivo()
 * Valida si el motor principal del SuperMotor está encendido (motorActivo === true).
 */
export async function verificarMotorActivo(
  colegioId: string = "SANTA_RITA_001"
): Promise<ResultadoVerificacionMotor> {
  const estado = await obtenerEstadoSuperMotor(colegioId);

  if (!estado.motorActivo) {
    return {
      autorizado: false,
      motorActivo: false,
      estadoJornada: estado.estadoJornada,
      motivo: "SUPERMOTOR_APAGADO",
      mensaje: "El motor principal del SuperMotor se encuentra apagado.",
    };
  }

  return {
    autorizado: true,
    motorActivo: true,
    estadoJornada: estado.estadoJornada,
  };
}

/**
 * FASE 4.1: verificarModuloActivo()
 * Valida si el módulo especificado y el motor principal están ambos activos.
 * Ejemplos:
 * verificarModuloActivo("asistencia")
 * verificarModuloActivo("telegram")
 * verificarModuloActivo("reportes")
 * verificarModuloActivo("fotos")
 * verificarModuloActivo("portal")
 */
export async function verificarModuloActivo(
  nombreModulo: string,
  colegioId: string = "SANTA_RITA_001"
): Promise<ResultadoVerificacionModulo> {
  const norm = normalizarModulo(nombreModulo);
  if (!norm) {
    return {
      autorizado: false,
      modulo: nombreModulo,
      campo: "",
      motivo: "MODULO_INVALIDO",
      mensaje: `El módulo '${nombreModulo}' no es reconocido por el SuperMotor.`,
    };
  }

  const estado = await obtenerEstadoSuperMotor(colegioId);

  // 1. Validar si el motor principal está activo
  if (!estado.motorActivo) {
    return {
      autorizado: false,
      modulo: norm.modulo,
      campo: norm.campo,
      motivo: "SUPERMOTOR_APAGADO",
      mensaje: "El motor central se encuentra apagado.",
      estado,
    };
  }

  // 2. Validar si el módulo individual está activo
  const valorModulo = Boolean((estado as any)[norm.campo]);
  if (!valorModulo) {
    return {
      autorizado: false,
      modulo: norm.modulo,
      campo: norm.campo,
      motivo: "MODULO_DESACTIVADO",
      mensaje: `El módulo '${norm.modulo}' se encuentra desactivado.`,
      estado,
    };
  }

  return {
    autorizado: true,
    modulo: norm.modulo,
    campo: norm.campo,
    estado,
  };
}

/**
 * FASE 4.7: Registrar auditoría cuando un módulo bloquea
 * Ejemplo:
 * Evento: ASISTENCIA_BLOQUEADA
 * Motivo: SUPERMOTOR_APAGADO
 */
export async function registrarAuditoriaBloqueo({
  modulo,
  motivo,
  usuario = "SISTEMA",
  detalles,
}: {
  modulo: string;
  motivo: "SUPERMOTOR_APAGADO" | "MODULO_DESACTIVADO" | string;
  usuario?: string;
  detalles?: any;
}) {
  try {
    const ahora = new Date();
    const accion = `${modulo.toUpperCase()}_BLOQUEADA`;

    await prisma.auditoria.create({
      data: {
        usuario,
        rol: "SISTEMA",
        accion,
        modulo: modulo.toUpperCase(),
        detalle: JSON.stringify({
          evento: accion,
          motivo,
          detalles: detalles || null,
          fechaPeru: fechaPeru(ahora),
          horaPeru: horaPeru(ahora),
        }),
      },
    });
  } catch (error) {
    console.warn(`[SUPERMOTOR GUARD] Error registrando auditoría de bloqueo (${modulo}):`, error);
  }
}

/**
 * FASE 4.7: Registrar auditoría cuando un módulo autoriza
 * Ejemplo:
 * Evento: ASISTENCIA_AUTORIZADA
 */
export async function registrarAuditoriaAutorizado({
  modulo,
  usuario = "SISTEMA",
  detalles,
}: {
  modulo: string;
  usuario?: string;
  detalles?: any;
}) {
  try {
    const ahora = new Date();
    const accion = `${modulo.toUpperCase()}_AUTORIZADA`;

    await prisma.auditoria.create({
      data: {
        usuario,
        rol: "SISTEMA",
        accion,
        modulo: modulo.toUpperCase(),
        detalle: JSON.stringify({
          evento: accion,
          detalles: detalles || null,
          fechaPeru: fechaPeru(ahora),
          horaPeru: horaPeru(ahora),
        }),
      },
    });
  } catch (error) {
    console.warn(`[SUPERMOTOR GUARD] Error registrando auditoría de autorización (${modulo}):`, error);
  }
}

/**
 * Helper para responder con el payload estándar de bloqueo requerido en la FASE 4.2:
 * {
 *   estado: "bloqueado",
 *   mensaje: "El sistema de asistencia se encuentra temporalmente desactivado."
 * }
 */
export function respuestaBloqueoSupermotor(
  mensaje: string = "El sistema de asistencia se encuentra temporalmente desactivado."
) {
  return NextResponse.json(
    {
      ok: false,
      estado: "bloqueado",
      mensaje,
      message: mensaje,
    },
    { status: 423 }
  );
}

/**
 * FASE 5.5: Registro de auditoría del Cron
 * Guarda:
 * - Fecha
 * - Hora Perú
 * - Proceso ejecutado
 * - Estado SuperMotor
 * - Resultado
 * Ejemplo:
 * Proceso: ALERTAS_ASISTENCIA
 * Estado: EJECUTADO
 * Motor: ACTIVO
 */
export async function registrarAuditoriaCron({
  proceso,
  estado,
  motor,
  jornada,
  detalles,
}: {
  proceso: string;
  estado: "EJECUTADO" | "OMITIDO" | "DETENIDO";
  motor: "ACTIVO" | "DETENIDO";
  jornada?: string;
  detalles?: any;
}) {
  try {
    const ahora = new Date();
    await prisma.auditoria.create({
      data: {
        usuario: "CRON_SUPERMOTOR",
        rol: "CRON",
        accion: `CRON_${proceso}`,
        modulo: "CRON",
        detalle: JSON.stringify({
          proceso,
          estado,
          motor,
          jornada: jornada || "OPERATIVO",
          fechaPeru: fechaPeru(ahora),
          horaPeru: horaPeru(ahora),
          detalles: detalles || null,
        }),
      },
    });
  } catch (error) {
    console.warn(`[SUPERMOTOR GUARD] Error registrando auditoría de cron (${proceso}):`, error);
  }
}

