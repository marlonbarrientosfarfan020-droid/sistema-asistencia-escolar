"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type EstadoConexionSSE = "conectando" | "conectado" | "desconectado" | "error";

export interface OpcionesRealtimeEvents {
  habilitado?: boolean;
  onAsistencia?: (datos: any) => void;
  onSalida?: (datos: any) => void;
  onSuperMotor?: (datos: any) => void;
  onModulo?: (datos: any) => void;
  onAlerta?: (datos: any) => void;
  onReporte?: (datos: any) => void;
  onJornadaIniciada?: (datos: any) => void;
  onJornadaCerrada?: (datos: any) => void;
  onEvent?: (tipo: string, datos: any) => void;
}

export function useRealtimeEvents(opciones: OpcionesRealtimeEvents = {}) {
  const {
    habilitado = true,
    onAsistencia,
    onSalida,
    onSuperMotor,
    onModulo,
    onAlerta,
    onReporte,
    onJornadaIniciada,
    onJornadaCerrada,
    onEvent,
  } = opciones;

  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionSSE>("desconectado");
  const [conectado, setConectado] = useState(false);
  const [ultimoEvento, setUltimoEvento] = useState<{ tipo: string; datos: any; hora: string } | null>(null);
  const [contadorEventos, setContadorEventos] = useState(0);

  // Referencias para evitar recrear listeners por cada render
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconexionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentosRef = useRef(0);
  const callbacksRef = useRef(opciones);

  useEffect(() => {
    callbacksRef.current = opciones;
  }, [opciones]);

  const conectar = useCallback(() => {
    if (!habilitado || typeof window === "undefined") return;

    // Limpiar conexión previa si existiera
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }

    setEstadoConexion("conectando");

    try {
      const es = new EventSource("/api/realtime/events", {
        withCredentials: true,
      });

      eventSourceRef.current = es;

      es.onopen = () => {
        setEstadoConexion("conectado");
        setConectado(true);
        intentosRef.current = 0; // Reiniciar contador de intentos exitosos
      };

      // Handler genérico de eventos
      const handleCustomEvent = (tipo: string, event: MessageEvent) => {
        try {
          const datos = JSON.parse(event.data);
          const hora = new Date().toLocaleTimeString("es-PE", { hour12: false });
          setUltimoEvento({ tipo, datos, hora });
          setContadorEventos((prev) => prev + 1);

          // Disparar callbacks correspondientes
          callbacksRef.current.onEvent?.(tipo, datos);

          if (tipo === "ASISTENCIA_REGISTRADA") {
            callbacksRef.current.onAsistencia?.(datos);
          } else if (tipo === "ASISTENCIA_SALIDA") {
            callbacksRef.current.onSalida?.(datos);
          } else if (tipo === "SUPERMOTOR_CAMBIO_ESTADO") {
            callbacksRef.current.onSuperMotor?.(datos);
          } else if (tipo === "MODULO_ACTIVADO" || tipo === "MODULO_DESACTIVADO") {
            callbacksRef.current.onModulo?.(datos);
            callbacksRef.current.onSuperMotor?.(datos);
          } else if (tipo === "ALERTA_GENERADA") {
            callbacksRef.current.onAlerta?.(datos);
          } else if (tipo === "REPORTE_GENERADO") {
            callbacksRef.current.onReporte?.(datos);
          } else if (tipo === "JORNADA_INICIADA") {
            callbacksRef.current.onJornadaIniciada?.(datos);
            callbacksRef.current.onSuperMotor?.(datos);
          } else if (tipo === "JORNADA_CERRADA") {
            callbacksRef.current.onJornadaCerrada?.(datos);
            callbacksRef.current.onSuperMotor?.(datos);
          }
        } catch (err) {
          console.error(`[SSE Client] Error parseando datos del evento ${tipo}:`, err);
        }
      };

      // Registrar listeners para cada tipo de evento
      es.addEventListener("CONECTADO", (e) => handleCustomEvent("CONECTADO", e));
      es.addEventListener("ASISTENCIA_REGISTRADA", (e) => handleCustomEvent("ASISTENCIA_REGISTRADA", e));
      es.addEventListener("ASISTENCIA_SALIDA", (e) => handleCustomEvent("ASISTENCIA_SALIDA", e));
      es.addEventListener("SUPERMOTOR_CAMBIO_ESTADO", (e) => handleCustomEvent("SUPERMOTOR_CAMBIO_ESTADO", e));
      es.addEventListener("MODULO_ACTIVADO", (e) => handleCustomEvent("MODULO_ACTIVADO", e));
      es.addEventListener("MODULO_DESACTIVADO", (e) => handleCustomEvent("MODULO_DESACTIVADO", e));
      es.addEventListener("ALERTA_GENERADA", (e) => handleCustomEvent("ALERTA_GENERADA", e));
      es.addEventListener("REPORTE_GENERADO", (e) => handleCustomEvent("REPORTE_GENERADO", e));
      es.addEventListener("JORNADA_INICIADA", (e) => handleCustomEvent("JORNADA_INICIADA", e));
      es.addEventListener("JORNADA_CERRADA", (e) => handleCustomEvent("JORNADA_CERRADA", e));

      es.onerror = () => {
        setEstadoConexion("error");
        setConectado(false);
        es.close();

        // Reconexión automática con retroceso exponencial (1s, 2s, 4s... max 15s)
        const delay = Math.min(1000 * Math.pow(1.5, intentosRef.current), 15000);
        intentosRef.current += 1;

        if (reconexionTimeoutRef.current) {
          clearTimeout(reconexionTimeoutRef.current);
        }

        reconexionTimeoutRef.current = setTimeout(() => {
          conectar();
        }, delay);
      };
    } catch (err) {
      console.error("[SSE Client] Error inicializando EventSource:", err);
      setEstadoConexion("error");
      setConectado(false);
    }
  }, [habilitado]);

  useEffect(() => {
    if (!habilitado) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setEstadoConexion("desconectado");
      setConectado(false);
      return;
    }

    conectar();

    return () => {
      if (reconexionTimeoutRef.current) {
        clearTimeout(reconexionTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setEstadoConexion("desconectado");
      setConectado(false);
    };
  }, [habilitado, conectar]);

  return {
    conectado,
    estadoConexion,
    ultimoEvento,
    contadorEventos,
    reconectar: conectar,
  };
}
