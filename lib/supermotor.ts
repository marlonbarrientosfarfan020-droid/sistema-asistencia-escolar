import { prisma } from '@/lib/prisma';
import { fechaPeru, horaPeru } from '@/lib/timezone';
import { emitEvent, COLEGIO_DEFAULT_ID } from '@/lib/events/eventBus';

export type ModuloSuperMotor =
  | 'asistencia'
  | 'fotos'
  | 'portal'
  | 'telegram'
  | 'whatsapp'
  | 'reportes'
  | 'ia'
  | 'alertas';

export type EstadoJornadaSuperMotor =
  | 'CERRADO'
  | 'APERTURA'
  | 'OPERATIVO'
  | 'CIERRE'
  | 'ABIERTO'
  | 'PAUSADO'
  | 'MANTENIMIENTO';

export const MAPA_CAMPOS_MODULO: Record<string, string> = {
  asistencia: 'asistenciaActivo',
  asistenciaactivo: 'asistenciaActivo',
  fotos: 'fotosActivo',
  fotosactivo: 'fotosActivo',
  portal: 'portalActivo',
  portalactivo: 'portalActivo',
  telegram: 'telegramActivo',
  telegramactivo: 'telegramActivo',
  whatsapp: 'whatsappActivo',
  whatsappactivo: 'whatsappActivo',
  reportes: 'reportesActivo',
  reportesactivo: 'reportesActivo',
  ia: 'iaActivo',
  iaactivo: 'iaActivo',
  alertas: 'alertasActivo',
  alertasactivo: 'alertasActivo',
};

export function normalizarModulo(modulo: string): { modulo: ModuloSuperMotor; campo: string } | null {
  const norm = String(modulo || '').toLowerCase().trim();
  const campo = MAPA_CAMPOS_MODULO[norm];
  if (!campo) return null;
  const nombreModulo = campo.replace('Activo', '').toLowerCase() as ModuloSuperMotor;
  return { modulo: nombreModulo, campo };
}

export function normalizarColegioId(colegioId?: string | null): string {
  if (!colegioId || colegioId === 'default') {
    return 'SANTA_RITA_001';
  }
  return String(colegioId).trim();
}

const cachePorColegio = new Map<string, { estado: any; timestamp: number }>();
const CACHE_TTL_MS = 5000;

export function invalidarCacheSuperMotor(colegioId?: string) {
  if (colegioId) {
    cachePorColegio.delete(normalizarColegioId(colegioId));
  } else {
    cachePorColegio.clear();
  }
}

/**
 * 1. obtenerEstadoSuperMotor()
 * Obtener configuración actual desde SistemaControl.
 * Devolver estado completo.
 * Si no existe configuración:
 * crear estado seguro:
 *   motorActivo = false
 *   estadoJornada = "CERRADO"
 */
export async function obtenerEstadoSuperMotor(colegioIdParam: string = 'SANTA_RITA_001') {
  const colegioId = normalizarColegioId(colegioIdParam);
  const ahora = Date.now();
  const cached = cachePorColegio.get(colegioId);
  if (cached && ahora - cached.timestamp < CACHE_TTL_MS) {
    return cached.estado;
  }

  try {
    let registro = await prisma.sistemaControl.findFirst({
      where: { colegioId },
      orderBy: { id: 'asc' },
    });

    if (!registro) {
      console.log('[SUPERMOTOR] Inicializando configuración segura APAGADA para: ' + colegioId);
      registro = await prisma.sistemaControl.create({
        data: {
          colegioId,
          motorActivo: false,
          asistenciaActivo: false,
          portalActivo: false,
          telegramActivo: false,
          whatsappActivo: false,
          reportesActivo: false,
          iaActivo: false,
          alertasActivo: false,
          fotosActivo: false,
          estadoJornada: 'CERRADO',
          ultimoUsuario: 'SISTEMA',
        },
      });
    }

    cachePorColegio.set(colegioId, { estado: registro, timestamp: ahora });
    return registro;
  } catch (error) {
    console.error('[SUPERMOTOR] Error consultando SistemaControl:', error);
    return {
      id: 0,
      colegioId,
      motorActivo: false,
      asistenciaActivo: false,
      portalActivo: false,
      telegramActivo: false,
      whatsappActivo: false,
      reportesActivo: false,
      iaActivo: false,
      alertasActivo: false,
      fotosActivo: false,
      estadoJornada: 'CERRADO',
      ultimaActivacion: null,
      ultimoUsuario: 'SISTEMA',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export type ModoOperacionSuperMotor = 'MANUAL' | 'AUTOMATICO';

export type ActualizarEstadoInput = {
  motorActivo?: boolean;
  estadoJornada?: EstadoJornadaSuperMotor | string;
  modoOperacion?: ModoOperacionSuperMotor | string;
  horaAperturaJornada?: string;
  horaCierreJornada?: string;
  minutosAnticipacionEntrada?: number;
  minutosCierreAutomatico?: number;
  usuario?: string;
  rol?: string;
  motivo?: string;
  colegioId?: string;
};

/**
 * 2. actualizarEstadoSuperMotor()
 * Debe permitir modificar:
 * motorActivo
 * estadoJornada
 * Registrar:
 * - usuario responsable
 * - fecha
 * - hora Perú
 */
export async function actualizarEstadoSuperMotor(
  inputOrMotorActivo: ActualizarEstadoInput | boolean,
  estadoJornadaParam?: EstadoJornadaSuperMotor | string,
  usuarioResponsableParam?: string,
  colegioIdParam: string = 'default'
) {
  let motorActivo: boolean | undefined;
  let estadoJornada: string | undefined;
  let usuario = 'ADMINISTRADOR';
  let rol = 'ADMIN';
  let motivo: string | undefined;
  let colegioId = 'default';

  if (typeof inputOrMotorActivo === 'object' && inputOrMotorActivo !== null) {
    motorActivo = inputOrMotorActivo.motorActivo;
    estadoJornada = inputOrMotorActivo.estadoJornada;
    usuario = inputOrMotorActivo.usuario || 'ADMINISTRADOR';
    rol = inputOrMotorActivo.rol || 'ADMIN';
    motivo = inputOrMotorActivo.motivo;
    colegioId = normalizarColegioId(inputOrMotorActivo.colegioId);
  } else {
    motorActivo = inputOrMotorActivo;
    estadoJornada = estadoJornadaParam;
    usuario = usuarioResponsableParam || 'ADMINISTRADOR';
    colegioId = normalizarColegioId(colegioIdParam);
  }

  const estadoAnterior = await obtenerEstadoSuperMotor(colegioId);
  const fechaActual = new Date();
  const fechaStr = fechaPeru(fechaActual);
  const horaStr = horaPeru(fechaActual);

  const dataToUpdate: any = {
    ultimoUsuario: usuario,
  };

  if (typeof inputOrMotorActivo === 'object' && inputOrMotorActivo !== null) {
    if (inputOrMotorActivo.modoOperacion !== undefined) {
      dataToUpdate.modoOperacion = String(inputOrMotorActivo.modoOperacion).toUpperCase();
    }
    if (inputOrMotorActivo.horaAperturaJornada !== undefined) {
      dataToUpdate.horaAperturaJornada = inputOrMotorActivo.horaAperturaJornada;
    }
    if (inputOrMotorActivo.horaCierreJornada !== undefined) {
      dataToUpdate.horaCierreJornada = inputOrMotorActivo.horaCierreJornada;
    }
    if (inputOrMotorActivo.minutosAnticipacionEntrada !== undefined) {
      dataToUpdate.minutosAnticipacionEntrada = Number(inputOrMotorActivo.minutosAnticipacionEntrada);
    }
    if (inputOrMotorActivo.minutosCierreAutomatico !== undefined) {
      dataToUpdate.minutosCierreAutomatico = Number(inputOrMotorActivo.minutosCierreAutomatico);
    }
  }

  if (motorActivo !== undefined) {
    dataToUpdate.motorActivo = Boolean(motorActivo);
    if (motorActivo) {
      dataToUpdate.ultimaActivacion = fechaActual;
    }
  }

  if (estadoJornada !== undefined) {
    dataToUpdate.estadoJornada = String(estadoJornada).toUpperCase();
  }

  const estadoNuevo = await prisma.sistemaControl.update({
    where: { id: estadoAnterior.id },
    data: dataToUpdate,
  });

  invalidarCacheSuperMotor(colegioId);

  // Registro en Auditoria (FASE 2.4)
  try {
    let accion = 'ACTUALIZAR_SUPERMOTOR';
    if (motorActivo !== undefined) {
      accion = motorActivo ? 'ACTIVAR_MOTOR' : 'DESACTIVAR_MOTOR';
    } else if (estadoJornada !== undefined) {
      accion = 'CAMBIAR_JORNADA_' + estadoJornada;
    }

    await prisma.auditoria.create({
      data: {
        usuario,
        rol,
        accion,
        modulo: 'SUPERMOTOR',
        detalle: JSON.stringify({
          usuario,
          accion,
          antes: {
            motorActivo: estadoAnterior.motorActivo,
            estadoJornada: estadoAnterior.estadoJornada,
          },
          despues: {
            motorActivo: estadoNuevo.motorActivo,
            estadoJornada: estadoNuevo.estadoJornada,
          },
          fechaPeru: fechaStr,
          horaPeru: horaStr,
          fechaHoraPeru: `${fechaStr} ${horaStr}`,
          motivo: motivo || 'Actualización de estado operativo del motor',
        }),
      },
    });
  } catch (err) {
    console.warn('[SUPERMOTOR] Aviso al registrar auditoria de estado:', err);
  }

  // FASE 6.6: Emitir evento en tiempo real
  const idColegioEmision = (!colegioId || colegioId === 'default') ? COLEGIO_DEFAULT_ID : colegioId;
  emitEvent('SUPERMOTOR_CAMBIO_ESTADO', {
    motorActivo: estadoNuevo.motorActivo,
    estadoJornada: estadoNuevo.estadoJornada,
    usuario,
    rol,
    motivo,
    estado: estadoNuevo,
  }, idColegioEmision);

  return estadoNuevo;
}

/**
 * 3. actualizarModuloSuperMotor()
 * Debe permitir cambiar módulos individuales:
 * Ejemplos:
 * asistenciaActivo
 * telegramActivo
 * whatsappActivo
 * reportesActivo
 * portalActivo
 * iaActivo
 * alertasActivo
 * fotosActivo
 * 
 * Registra usuario responsable, fecha y hora Perú en Auditoría.
 */
export async function actualizarModuloSuperMotor(
  modulo: string,
  activo: boolean,
  usuario: string = 'ADMINISTRADOR',
  rol: string = 'ADMIN',
  colegioIdParam: string = 'SANTA_RITA_001'
) {
  const colegioId = normalizarColegioId(colegioIdParam);
  const norm = normalizarModulo(modulo);
  if (!norm) {
    throw new Error('Módulo ' + modulo + ' no reconocido en el SuperMotor');
  }

  const estadoAnterior = await obtenerEstadoSuperMotor(colegioId);
  const valorAnterior = Boolean((estadoAnterior as any)[norm.campo]);
  const fechaActual = new Date();
  const fechaStr = fechaPeru(fechaActual);
  const horaStr = horaPeru(fechaActual);

  const estadoNuevo = await prisma.sistemaControl.update({
    where: { id: estadoAnterior.id },
    data: {
      [norm.campo]: Boolean(activo),
      ultimoUsuario: usuario,
    },
  });

  invalidarCacheSuperMotor(colegioId);

  // Registro en Auditoria (FASE 2.4)
  try {
    const accion = activo
      ? 'ACTIVAR_' + norm.modulo.toUpperCase()
      : 'DESACTIVAR_' + norm.modulo.toUpperCase();

    await prisma.auditoria.create({
      data: {
        colegioId,
        usuario,
        rol,
        accion,
        modulo: 'SUPERMOTOR',
        detalle: JSON.stringify({
          usuario,
          accion,
          colegioId,
          modulo: norm.modulo,
          campo: norm.campo,
          antes: valorAnterior,
          despues: Boolean(activo),
          fechaPeru: fechaStr,
          horaPeru: horaStr,
          fechaHoraPeru: `${fechaStr} ${horaStr}`,
        }),
      },
    });
  } catch (err) {
    console.warn('[SUPERMOTOR] Aviso al registrar auditoria de modulo:', err);
  }

  // FASE 6.6: Emitir eventos en tiempo real
  const tipoEventoModulo = activo ? 'MODULO_ACTIVADO' : 'MODULO_DESACTIVADO';
  emitEvent(tipoEventoModulo, {
    colegioId,
    modulo: norm.modulo,
    campo: norm.campo,
    activo: Boolean(activo),
    usuario,
    rol,
    estado: estadoNuevo,
  }, colegioId);

  emitEvent('SUPERMOTOR_CAMBIO_ESTADO', {
    colegioId,
    motorActivo: estadoNuevo.motorActivo,
    estadoJornada: estadoNuevo.estadoJornada,
    moduloModificado: norm.modulo,
    moduloActivo: Boolean(activo),
    usuario,
    rol,
    estado: estadoNuevo,
  }, colegioId);

  return estadoNuevo;
}

/**
 * 4. validarModuloActivo()
 * Devuelve true o false.
 * Preparada para ser utilizada posteriormente por:
 * - APIs de asistencia.
 * - Cron.
 * - Notificaciones.
 * - Reportes.
 */
export async function validarModuloActivo(
  modulo: string,
  colegioIdParam: string = 'SANTA_RITA_001'
): Promise<boolean> {
  try {
    const colegioId = normalizarColegioId(colegioIdParam);
    const estado = await obtenerEstadoSuperMotor(colegioId);

    // 1. Si el motor principal está apagado, ningún módulo opera
    if (!estado.motorActivo) {
      return false;
    }

    const norm = normalizarModulo(modulo);
    if (!norm) {
      const limpio = modulo.toLowerCase().trim();
      if (limpio === 'motor' || limpio === 'motoractivo') {
        return Boolean(estado.motorActivo);
      }
      return false;
    }

    return Boolean((estado as any)[norm.campo]);
  } catch (error) {
    console.error('[SUPERMOTOR] Error al validar modulo ' + modulo + ':', error);
    return false;
  }
}
