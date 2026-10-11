"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type EstadoConexionSSE = "conectando" | "conectado" | "desconectado" | "error";

export interface OpcionesRealtimeEvents {
  habilitado?: boolean;
  onAsistencia?: (datos: any) => void;
  onSalida?: (datos: any) => void;
  onSalidaExcepcional?: (datos: any) => void;
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
    onSalidaExcepcional,
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
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intentosRef = useRef(0);
  const callbacksRef = useRef(opciones);
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const ultimoAsistenciaIdRef = useRef<number>(0);
  const ultimoSyncTimestampRef = useRef<string>("");

  useEffect(() => {
    callbacksRef.current = opciones;
  }, [opciones]);

  // Sincronización incremental de respaldo contra PostgreSQL (Resiliente a Vercel Serverless)
  const sincronizarDelta = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams({
        ultimoId: String(ultimoAsistenciaIdRef.current),
        limite: "50",
      });
      if (ultimoSyncTimestampRef.current) {
        params.set("desde", ultimoSyncTimestampRef.current);
      }

      const res = await fetch(`/api/realtime/sync?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data?.ok || !Array.isArray(data.asistencias)) return;

      if (data.servidorTimestamp) {
        ultimoSyncTimestampRef.current = data.servidorTimestamp;
      }
      if (typeof data.ultimoId === "number" && data.ultimoId > ultimoAsistenciaIdRef.current) {
        ultimoAsistenciaIdRef.current = data.ultimoId;
      }

      for (const a of data.asistencias) {
        const horaStr = a.horaSalida || a.horaEntrada || a.updatedAt || new Date().toISOString();
        const hora = new Date(horaStr).toLocaleTimeString("es-PE", { hour12: false });

        // Procesar evento de SALIDA si existe horaSalida
        if (a.horaSalida) {
          const keySalida = `SALIDA_${a.id}`;
          if (!seenEventKeysRef.current.has(keySalida)) {
            seenEventKeysRef.current.add(keySalida);
            setUltimoEvento({ tipo: "ASISTENCIA_SALIDA", datos: a, hora });
            setContadorEventos((prev) => prev + 1);

            callbacksRef.current.onSalida?.(a);
            callbacksRef.current.onEvent?.("ASISTENCIA_SALIDA", a);
          }
        }

        // Procesar evento de ENTRADA si existe horaEntrada (y no fue únicamente una salida)
        if (a.horaEntrada) {
          const keyEntrada = `ENTRADA_${a.id}`;
          if (!seenEventKeysRef.current.has(keyEntrada)) {
            seenEventKeysRef.current.add(keyEntrada);
            if (!a.horaSalida) {
              setUltimoEvento({ tipo: "ASISTENCIA_REGISTRADA", datos: a, hora });
              setContadorEventos((prev) => prev + 1);
            }
            callbacksRef.current.onAsistencia?.(a);
            callbacksRef.current.onEvent?.("ASISTENCIA_REGISTRADA", a);
          }
        }
      }
    } catch (err) {
      // Error silencioso en sincronización periódica
    }
  }, []);

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

      // Handler genérico de eventos con prevención de duplicados
      const handleCustomEvent = (tipo: string, event: MessageEvent) => {
        try {
          const datos = JSON.parse(event.data);

          // Clave de unicidad para deduplicar eventos entre SSE y Polling incremental
          const marcaId = datos?.asistenciaId || datos?.id || (datos as any)?.asistencia?.id;
          if (marcaId && Number(marcaId) > ultimoAsistenciaIdRef.current) {
            ultimoAsistenciaIdRef.current = Number(marcaId);
          }

          const uniqueKey = tipo === "ASISTENCIA_SALIDA" && marcaId
            ? `SALIDA_${marcaId}`
            : tipo === "ASISTENCIA_REGISTRADA" && marcaId
            ? `ENTRADA_${marcaId}`
            : tipo === "SALIDA_EXCEPCIONAL_REGISTRADA"
            ? `SALIDA_EXC_${datos.salidaExcepcionalId || marcaId || Date.now()}`
            : `${tipo}_${datos?.timestamp || Date.now()}_${Math.random().toString(36).substring(7)}`;

          if (seenEventKeysRef.current.has(uniqueKey)) {
            return; // Descartar evento duplicado
          }
          seenEventKeysRef.current.add(uniqueKey);

          const hora = new Date().toLocaleTimeString("es-PE", { hour12: false });
          setUltimoEvento({ tipo, datos, hora });
          setContadorEventos((prev) => prev + 1);

          // Disparar callbacks correspondientes
          callbacksRef.current.onEvent?.(tipo, datos);

          if (tipo === "ASISTENCIA_REGISTRADA") {
            callbacksRef.current.onAsistencia?.(datos);
          } else if (tipo === "ASISTENCIA_SALIDA") {
            callbacksRef.current.onSalida?.(datos);
          } else if (tipo === "SALIDA_EXCEPCIONAL_REGISTRADA") {
            callbacksRef.current.onSalidaExcepcional?.(datos);
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
      es.addEventListener("SALIDA_EXCEPCIONAL_REGISTRADA", (e) => handleCustomEvent("SALIDA_EXCEPCIONAL_REGISTRADA", e));
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

    // Sincronización de respaldo incremental cada 6 segundos para garantizar entrega serverless
    void sincronizarDelta();
    syncIntervalRef.current = setInterval(() => {
      void sincronizarDelta();
    }, 6000);

    return () => {
      if (reconexionTimeoutRef.current) {
        clearTimeout(reconexionTimeoutRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setEstadoConexion("desconectado");
      setConectado(false);
    };
  }, [habilitado, conectar, sincronizarDelta]);

  return {
    conectado,
    estadoConexion,
    ultimoEvento,
    contadorEventos,
    reconectar: conectar,
  };
}
