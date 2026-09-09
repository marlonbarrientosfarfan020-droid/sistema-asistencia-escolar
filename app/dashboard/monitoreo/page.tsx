"use client";

import { useEffect, useState, useCallback } from "react";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

type DiagnosticoData = {
  sistema: string;
  database: string;
  supermotor: string;
  cron: string;
  timestamp: string;
  colegioId: string;
  servicios: {
    database: {
      nombre: string;
      estado: "OK" | "WARNING" | "ERROR";
      tiempoRespuesta: number;
      mensaje: string;
      conexionPrisma: string;
      ultimaConsulta: string;
    };
    supermotor: {
      nombre: string;
      estado: "OK" | "WARNING" | "ERROR";
      motorActivo: boolean;
      estadoJornada: string;
      modoOperacion: string;
      ultimaActivacion: string;
      ultimoUsuario: string;
    };
    cron: {
      nombre: string;
      estado: "OK" | "WARNING" | "ERROR";
      ultimaEjecucion: string;
      tiempoEjecucion: string;
      resultado: string;
      ultimoError: string;
    };
    telegram: {
      nombre: string;
      estado: "OK" | "WARNING" | "ERROR";
      configurado: boolean;
      ultimoMensaje: string;
      ultimoError: string;
    };
    whatsapp: {
      nombre: string;
      estado: "OK" | "WARNING" | "ERROR";
      habilitado: boolean;
      configurado: boolean;
      ultimoEnvio: string;
      ultimoError: string;
    };
    storage: {
      nombre: string;
      estado: "OK" | "WARNING" | "ERROR";
      configurado: boolean;
      ultimaSubida: string;
      ultimoRegistro: string;
    };
  };
  alertas: Array<{
    id: string;
    nivel: "CRITICA" | "ADVERTENCIA" | "INFO";
    servicio: string;
    mensaje: string;
    timestamp: string;
  }>;
  historial: Array<{
    id: number;
    servicio: string;
    estado: string;
    mensaje: string;
    tiempoRespuesta: number;
    fechaHora: string;
  }>;
};

export default function MonitoreoPage() {
  const { configuracion } = useConfiguracionColegio();
  const [datos, setDatos] = useState<DiagnosticoData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);
  const [autoRefrescar, setAutoRefrescar] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>("");

  const cargarDiagnostico = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.status === 401 || res.status === 403) {
        setErrorAcceso("No tiene permisos para acceder al Centro de Monitoreo (Exclusivo Administradores y Directores)");
        setCargando(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Error ${res.status} al consultar salud`);
      }
      const data: DiagnosticoData = await res.json();
      setDatos(data);
      setUltimaActualizacion(new Date().toLocaleTimeString("es-PE", { hour12: false }));
      setErrorAcceso(null);
    } catch (err: any) {
      console.error("Error cargando diagnóstico:", err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDiagnostico();
  }, [cargarDiagnostico]);

  // Auto-refresco cada 10 segundos si está activo
  useEffect(() => {
    if (!autoRefrescar) return;
    const interval = setInterval(() => {
      cargarDiagnostico();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefrescar, cargarDiagnostico]);

  // Actualización en tiempo real vía SSE
  useRealtimeEvents({
    onSuperMotor: () => cargarDiagnostico(),
    onJornadaIniciada: () => cargarDiagnostico(),
    onJornadaCerrada: () => cargarDiagnostico(),
  });

  if (errorAcceso) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm max-w-md">
          <span className="text-5xl">🔒</span>
          <h2 className="mt-4 text-xl font-bold text-red-900">Acceso Restringido</h2>
          <p className="mt-2 text-sm text-red-700">{errorAcceso}</p>
        </div>
      </div>
    );
  }

  const getBadgeEstado = (estado?: "OK" | "WARNING" | "ERROR" | string) => {
    switch (estado) {
      case "OK":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            🟢 Operativo
          </span>
        );
      case "WARNING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            🟡 Advertencia
          </span>
        );
      case "ERROR":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            🔴 Error
          </span>
        );
    }
  };

  const getIconoServicio = (servicio: string) => {
    switch (servicio) {
      case "DATABASE":
        return "🗄️";
      case "SUPERMOTOR":
        return "🚀";
      case "CRON":
        return "⏱️";
      case "TELEGRAM":
        return "✈️";
      case "WHATSAPP":
        return "💬";
      case "STORAGE":
        return "📸";
      default:
        return "⚙️";
    }
  };

  return (
    <div className="min-h-screen space-y-6 pb-12">
      {/* Cabecera Principal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">🩺</span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Centro de Monitoreo y Salud del Sistema
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Observabilidad en tiempo real de la infraestructura crítica de{" "}
              <span className="font-semibold text-slate-800">{configuracion?.nombreColegio || "la Institución"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefrescar(!autoRefrescar)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                autoRefrescar
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
            >
              {autoRefrescar ? "⚡ Auto-refresco: Activo" : "⏸️ Auto-refresco: Pausado"}
            </button>

            <button
              onClick={() => {
                setCargando(true);
                cargarDiagnostico();
              }}
              disabled={cargando}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              🔄 {cargando ? "Actualizando..." : "Actualizar Diagnóstico"}
            </button>
          </div>
        </div>

        {/* Barra de Estado Global */}
        {datos && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-xl">
                {datos.sistema === "OK" ? "✅" : datos.sistema === "ADVERTENCIA" ? "⚠️" : "❌"}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Estado General del Sistema
                </p>
                <p className="text-base font-bold text-slate-900">
                  {datos.sistema === "OK"
                    ? "Todos los servicios operando normalmente"
                    : datos.sistema === "ADVERTENCIA"
                    ? "Atención requerida en algunos servicios"
                    : "Anomalía crítica detectada"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-600">
              <div>
                <span className="text-slate-400">Latencia BD:</span>{" "}
                <span className="font-semibold text-slate-800">{datos.servicios.database.tiempoRespuesta}ms</span>
              </div>
              <div>
                <span className="text-slate-400">Hora Perú:</span>{" "}
                <span className="font-semibold text-slate-800">{datos.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-400">Última lectura:</span>{" "}
                <span className="font-semibold text-slate-800">{ultimaActualizacion || "--:--:--"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel de Alertas Activas (si existen) */}
      {datos && datos.alertas && datos.alertas.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <span className="text-xl">⚠️</span>
            <h3>Alertas Internas del Sistema ({datos.alertas.length})</h3>
          </div>
          <div className="mt-3 space-y-2">
            {datos.alertas.map((alt) => (
              <div
                key={alt.id}
                className="flex items-center justify-between rounded-lg border border-amber-300 bg-white p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-900">[{alt.servicio}]</span>
                  <span className="text-slate-800">{alt.mensaje}</span>
                </div>
                <span className="text-xs text-slate-500">{alt.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de 6 Tarjetas de Estado */}
      {datos && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. BASE DE DATOS */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl border border-blue-100">
                    🗄️
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Base de Datos</h3>
                    <p className="text-xs text-slate-500">PostgreSQL (Neon Cloud)</p>
                  </div>
                </div>
                {getBadgeEstado(datos.servicios.database.estado)}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiempo de respuesta:</span>
                  <span className="font-semibold text-slate-900">{datos.servicios.database.tiempoRespuesta} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conexión Prisma:</span>
                  <span className="font-semibold text-emerald-700">{datos.servicios.database.conexionPrisma}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última consulta:</span>
                  <span className="font-medium text-slate-800">{datos.servicios.database.ultimaConsulta}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-600">
              {datos.servicios.database.mensaje}
            </div>
          </div>

          {/* 2. SUPERMOTOR */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl border border-purple-100">
                    🚀
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">SuperMotor</h3>
                    <p className="text-xs text-slate-500">Motor Central Inteligente</p>
                  </div>
                </div>
                {getBadgeEstado(datos.servicios.supermotor.motorActivo ? "OK" : "WARNING")}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Estado Jornada:</span>
                  <span className="font-semibold text-slate-900">{datos.servicios.supermotor.estadoJornada}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Modo de Operación:</span>
                  <span className="font-semibold text-purple-700">{datos.servicios.supermotor.modoOperacion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última activación:</span>
                  <span className="font-medium text-slate-800">{datos.servicios.supermotor.ultimaActivacion}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-600">
              Responsable: <span className="font-semibold">{datos.servicios.supermotor.ultimoUsuario}</span>
            </div>
          </div>

          {/* 3. CRON JOB */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl border border-emerald-100">
                    ⏱️
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Cron Job</h3>
                    <p className="text-xs text-slate-500">Automatizaciones periódicas</p>
                  </div>
                </div>
                {getBadgeEstado(datos.servicios.cron.estado)}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Última ejecución:</span>
                  <span className="font-semibold text-slate-900">{datos.servicios.cron.ultimaEjecucion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiempo de ejecución:</span>
                  <span className="font-semibold text-slate-900">{datos.servicios.cron.tiempoEjecucion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Resultado:</span>
                  <span className="font-medium text-emerald-700">{datos.servicios.cron.resultado}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-600 truncate">
              Último error: <span className="font-semibold">{datos.servicios.cron.ultimoError}</span>
            </div>
          </div>

          {/* 4. TELEGRAM */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-xl border border-sky-100">
                    ✈️
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Telegram</h3>
                    <p className="text-xs text-slate-500">Bot de notificaciones</p>
                  </div>
                </div>
                {getBadgeEstado(datos.servicios.telegram.estado)}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bot Configurado:</span>
                  <span className="font-semibold text-slate-900">
                    {datos.servicios.telegram.configurado ? "Sí (Activo)" : "No configurado"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Último mensaje:</span>
                  <span className="font-medium text-slate-800">{datos.servicios.telegram.ultimoMensaje}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-600 truncate">
              Último error: <span className="font-semibold">{datos.servicios.telegram.ultimoError}</span>
            </div>
          </div>

          {/* 5. WHATSAPP */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-xl border border-green-100">
                    💬
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">WhatsApp</h3>
                    <p className="text-xs text-slate-500">Cloud API Business</p>
                  </div>
                </div>
                {getBadgeEstado(datos.servicios.whatsapp.estado)}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Configuración:</span>
                  <span className="font-semibold text-slate-900">
                    {datos.servicios.whatsapp.configurado ? "Disponible" : "Incompleta"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Último envío:</span>
                  <span className="font-medium text-slate-800">{datos.servicios.whatsapp.ultimoEnvio}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-600 truncate">
              Errores: <span className="font-semibold">{datos.servicios.whatsapp.ultimoError}</span>
            </div>
          </div>

          {/* 6. VERCEL BLOB / FOTOS */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-xl border border-rose-100">
                    📸
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Vercel Blob / Fotos</h3>
                    <p className="text-xs text-slate-500">Evidencias fotográficas</p>
                  </div>
                </div>
                {getBadgeEstado(datos.servicios.storage.estado)}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Almacenamiento:</span>
                  <span className="font-semibold text-slate-900">
                    {datos.servicios.storage.configurado ? "Operativo" : "Sin credenciales"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última subida:</span>
                  <span className="font-medium text-slate-800">{datos.servicios.storage.ultimaSubida}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-600 truncate">
              Estudiante: <span className="font-semibold">{datos.servicios.storage.ultimoRegistro}</span>
            </div>
          </div>
        </div>
      )}

      {/* Historial de Eventos de Salud */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <h2 className="text-lg font-bold text-slate-900">Historial de Eventos del Sistema (SystemHealthLog)</h2>
          </div>
          <span className="text-xs text-slate-500">Últimos registros en Neon PostgreSQL</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Mensaje / Diagnóstico</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {datos && datos.historial && datos.historial.length > 0 ? (
                datos.historial.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                      <span className="mr-1.5">{getIconoServicio(ev.servicio)}</span>
                      {ev.servicio}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{getBadgeEstado(ev.estado)}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-md truncate">{ev.mensaje || "Sin mensaje"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {ev.tiempoRespuesta ? `${ev.tiempoRespuesta}ms` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {new Date(ev.fechaHora).toLocaleTimeString("es-PE", { hour12: false })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No se registran eventos de salud aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
