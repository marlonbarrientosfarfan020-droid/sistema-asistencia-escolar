import { EventEmitter } from "events";
import { fechaPeru, horaPeru } from "@/lib/timezone";

export type TipoEvento =
  | "ASISTENCIA_REGISTRADA"
  | "ASISTENCIA_SALIDA"
  | "SUPERMOTOR_CAMBIO_ESTADO"
  | "MODULO_ACTIVADO"
  | "MODULO_DESACTIVADO"
  | "ALERTA_GENERADA"
  | "REPORTE_GENERADO"
  | "JORNADA_INICIADA"
  | "JORNADA_CERRADA";

export interface EventoEscolar<T = any> {
  id: string;
  tipo: TipoEvento;
  colegioId: string;
  timestamp: string; // ISO string
  horaPeru: string;
  fechaPeru: string;
  datos: T;
}

export const COLEGIO_DEFAULT_ID = "SANTA_RITA_001";

// Conservar el bus en globalThis para sobrevivir a recargas de módulos / HMR en Next.js
const globalParaEventos = globalThis as unknown as {
  escolarEventBus?: EventEmitter;
};

export const eventBus: EventEmitter =
  globalParaEventos.escolarEventBus || new EventEmitter();

// Incrementar límite de listeners para múltiples conexiones SSE concurrentes
eventBus.setMaxListeners(500);

if (process.env.NODE_ENV !== "production") {
  globalParaEventos.escolarEventBus = eventBus;
}

/**
 * Publicar un evento en el bus central del SuperMotor.
 */
export function emitEvent<T = any>(
  tipo: TipoEvento,
  datos: T,
  colegioId: string = COLEGIO_DEFAULT_ID
): EventoEscolar<T> {
  const evento: EventoEscolar<T> = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    tipo,
    colegioId,
    timestamp: new Date().toISOString(),
    horaPeru: horaPeru(),
    fechaPeru: fechaPeru(),
    datos,
  };

  try {
    // Emitir evento específico y evento global comodín
    eventBus.emit(tipo, evento);
    eventBus.emit("*", evento);
  } catch (error) {
    console.error(`[EVENT_BUS] Error al emitir evento ${tipo}:`, error);
  }

  return evento;
}

/**
 * Suscribirse a eventos del SuperMotor.
 * @param listener Callback invocado al recibir un evento.
 * @param tipo Opcional: filtrar por tipo específico. Si no se pasa, escucha todos.
 * @returns Función para desuscribirse limpiamente.
 */
export function subscribeEvent(
  listener: (evento: EventoEscolar) => void,
  tipo?: TipoEvento | "*"
): () => void {
  const canal = tipo || "*";

  eventBus.on(canal, listener);

  return () => {
    eventBus.off(canal, listener);
  };
}
