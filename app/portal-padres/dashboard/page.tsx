"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SelectorHijas, EstudianteHija } from "@/components/portal-padres/SelectorHijas";
import { GraficosPadre } from "@/components/portal-padres/GraficosPadre";
import { TablaAsistenciasHija } from "@/components/portal-padres/TablaAsistenciasHija";
import { ModalFotoEvidencia, AsistenciaEvidencia } from "@/components/portal-padres/ModalFotoEvidencia";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

interface FamiliaInfo {
  id: number;
  codigo: string;
  tutorTitular: string;
  telefonoContacto: string;
  ultimoIngresoAt?: string | null;
}

interface DatosPortal {
  familia: FamiliaInfo;
  estudiantes: EstudianteHija[];
  estudianteActiva: EstudianteHija;
  metricasEstudiante: {
    totalRegistros: number;
    puntuales: number;
    tardanzas: number;
    justificados: number;
    porcentajePuntualidad: number;
  };
  distribucionDona: Array<{ name: string; valor: number; color: string }>;
  barrasMeses: Array<{ mes: string; puntuales: number; tardanzas: number }>;
  asistencias: AsistenciaEvidencia[];
  infoColegio: {
    nombreColegio: string;
    logoUrl: string;
    telefono: string;
    correo: string;
  };
}

export default function PortalPadresDashboardPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosPortal | null>(null);
  const [estudianteIdSeleccionada, setEstudianteIdSeleccionada] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [evidenciaSeleccionada, setEvidenciaSeleccionada] = useState<AsistenciaEvidencia | null>(null);
  const [notificacionEnVivo, setNotificacionEnVivo] = useState<{
    tipo: "ENTRADA" | "SALIDA" | "SALIDA_EXCEPCIONAL";
    estudianteNombre: string;
    hora: string;
    fecha: string;
    estado: string;
    fotoUrl?: string;
    mensaje: string;
    motivo?: string;
    motivoEtiqueta?: string;
    observacion?: string;
    usuarioRegistro?: string;
  } | null>(null);

  const cargarDatos = useCallback(async (estudianteId?: number) => {
    try {
      setCargando(true);
      const url = estudianteId
        ? `/api/portal-padres/datos?estudianteId=${estudianteId}`
        : "/api/portal-padres/datos";

      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });

      if (res.status === 401) {
        router.replace("/portal-padres");
        return;
      }

      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const json = await res.json();
          if (json && json.ok) {
            setDatos(json);
            setEstudianteIdSeleccionada(json.estudianteActiva.id);
          }
        }
      }
    } catch (error) {
      console.warn("Aviso al cargar datos del portal de familias:", error);
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function handleSeleccionarHija(id: number) {
    if (id === estudianteIdSeleccionada) return;
    setEstudianteIdSeleccionada(id);
    cargarDatos(id);
  }

  // FASE 6.5: Conectar eventos en tiempo real para el portal de familias (Aislamiento Estricto)
  const handleAsistenciaEnVivo = useCallback(
    (evento: any) => {
      const idEvento = Number(evento.estudianteId || evento.datos?.estudianteId || evento.estudiante?.id);

      // REGLA DE SEGURIDAD ESTRICTA: Descartar si el evento no pertenece a sus hijas autorizadas
      const perteneceAFamilia = datos?.estudiantes?.some((h) => h.id === idEvento);
      if (!perteneceAFamilia) {
        return; // Alumna ajena bloqueada inmediatamente
      }

      const nombreEstudiante = `${evento.estudiante?.nombres || ""} ${evento.estudiante?.apellidos || ""}`.trim();
      const estadoStr = evento.estado === "TARDE" ? "TARDANZA" : "PUNTUAL";
      const esEntrada = evento.tipo === "ENTRADA" || !evento.tipo;

      setNotificacionEnVivo({
        tipo: esEntrada ? "ENTRADA" : "SALIDA",
        estudianteNombre: nombreEstudiante || "Su hija",
        hora: evento.hora || evento.hora24 || new Date().toLocaleTimeString("es-PE", { hour12: true }),
        fecha: evento.fecha || new Date().toLocaleDateString("es-PE"),
        estado: estadoStr,
        fotoUrl: evento.fotoUrl,
        mensaje: esEntrada ? "?? Ingres� al colegio" : "?? Sali� del colegio",
      });

      // Actualizar datos de fondo para sincronizar gr�ficos y tabla
      if (estudianteIdSeleccionada && idEvento === estudianteIdSeleccionada) {
        cargarDatos(estudianteIdSeleccionada);
      } else if (idEvento) {
        cargarDatos(idEvento);
      }
    },
    [estudianteIdSeleccionada, datos?.estudiantes, cargarDatos]
  );

  const handleSalidaExcepcionalEnVivo = useCallback(
    (evento: any) => {
      const idEvento = Number(evento.estudianteId || evento.datos?.estudianteId || evento.estudiante?.id);

      // REGLA DE SEGURIDAD ESTRICTA: Descartar si el evento no pertenece a sus hijas autorizadas
      const perteneceAFamilia = datos?.estudiantes?.some((h) => h.id === idEvento);
      if (!perteneceAFamilia) {
        return; // Alumna ajena bloqueada inmediatamente
      }

      const nombreEstudiante =
        typeof evento.estudiante === "string"
          ? evento.estudiante
          : `${evento.estudiante?.nombres || ""} ${evento.estudiante?.apellidos || ""}`.trim() ||
            evento.estudianteNombre;

      setNotificacionEnVivo({
        tipo: "SALIDA_EXCEPCIONAL",
        estudianteNombre: nombreEstudiante || "Su hija",
        hora:
          evento.hora ||
          evento.hora24 ||
          new Date().toLocaleTimeString("es-PE", { hour12: true }),
        fecha: evento.fecha || new Date().toLocaleDateString("es-PE"),
        estado: "SALIDA EXCEPCIONAL",
        fotoUrl: evento.fotoUrl,
        mensaje: "?? Salida Excepcional Autorizada",
        motivo: evento.motivo,
        motivoEtiqueta: evento.motivoEtiqueta || evento.motivo,
        observacion: evento.observacion,
        usuarioRegistro: evento.usuarioRegistro,
      });

      if (estudianteIdSeleccionada && idEvento === estudianteIdSeleccionada) {
        cargarDatos(estudianteIdSeleccionada);
      } else if (idEvento) {
        cargarDatos(idEvento);
      }
    },
    [estudianteIdSeleccionada, datos?.estudiantes, cargarDatos]
  );

  const { conectado: sseConectado } = useRealtimeEvents({
    onAsistencia: handleAsistenciaEnVivo,
    onSalida: handleAsistenciaEnVivo,
    onSalidaExcepcional: handleSalidaExcepcionalEnVivo,
  });

  async function handleLogout() {
    try {
      setCerrandoSesion(true);
      await fetch("/api/portal-padres/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/portal-padres");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
      router.replace("/portal-padres");
    }
  }

  if (cargando && !datos) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800">
          <span className="animate-spin text-xl">⏳</span>
          <span className="font-bold text-sm">Cargando expediente escolar de su familia...</span>
        </div>
      </main>
    );
  }

  if (!datos) return null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-amber-400 selection:text-slate-950">
      {/* 1. Barra Superior Institucional para Padres */}
      <header className="sticky top-0 z-40 bg-slate-950 text-white border-b-2 border-red-900/60 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo y Familia */}
            <div className="flex items-center gap-3.5">
              <Link href="/" className="shrink-0 group">
                <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md ring-2 ring-amber-400/30 group-hover:ring-amber-400 transition">
                  <Image
                    src={datos.infoColegio.logoUrl || "/img/logo-santa-rita.png"}
                    alt="Escudo Santa Rita"
                    width={48}
                    height={48}
                    className="object-contain w-full h-full"
                  />
                </div>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-white tracking-tight">
                    {datos.infoColegio.nombreColegio}
                  </span>
                  <span className="font-mono text-[10px] font-black uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-400/30">
                    {datos.familia.codigo}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Familia de <strong className="text-white">{datos.familia.tutorTitular || "nuestras alumnas"}</strong>
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden sm:inline-flex text-xs font-bold text-slate-400 hover:text-white transition px-3 py-2 rounded-xl hover:bg-slate-900"
              >
                Portada Web
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={cerrandoSesion}
                className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>🚪</span>
                <span>{cerrandoSesion ? "Saliendo..." : "Cerrar Sesión"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        {/* Banner de Monitoreo en Vivo */}
        {notificacionEnVivo && (
          <div
            className={`rounded-2xl border-2 p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-300 ${
              notificacionEnVivo.tipo === "SALIDA_EXCEPCIONAL"
                ? "border-amber-500/80 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950"
                : notificacionEnVivo.tipo === "ENTRADA"
                ? "border-emerald-500/80 bg-gradient-to-r from-emerald-900/95 via-slate-900 to-emerald-950/95"
                : "border-blue-500/80 bg-gradient-to-r from-blue-900/95 via-slate-900 to-blue-950/95"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0 ${
                  notificacionEnVivo.tipo === "SALIDA_EXCEPCIONAL"
                    ? "bg-amber-500/20 border-amber-400 text-amber-300"
                    : notificacionEnVivo.tipo === "ENTRADA"
                    ? "bg-emerald-500/20 border-emerald-400"
                    : "bg-blue-500/20 border-blue-400"
                }`}
              >
                {notificacionEnVivo.tipo === "SALIDA_EXCEPCIONAL"
                  ? "⚠️"
                  : notificacionEnVivo.tipo === "ENTRADA"
                  ? "🟢"
                  : "👋"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-black uppercase tracking-wide text-xs ${
                      notificacionEnVivo.tipo === "SALIDA_EXCEPCIONAL"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {notificacionEnVivo.mensaje}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      notificacionEnVivo.tipo === "SALIDA_EXCEPCIONAL"
                        ? "bg-amber-400/20 text-amber-200 border-amber-400/40"
                        : "bg-emerald-400/20 text-emerald-200 border-emerald-400/40"
                    }`}
                  >
                    {notificacionEnVivo.motivoEtiqueta || notificacionEnVivo.estado}
                  </span>
                </div>
                <p className="font-extrabold text-base text-white mt-0.5">
                  {notificacionEnVivo.estudianteNombre}
                </p>
                <p className="text-xs text-slate-300">
                  Hora: <strong className="text-white">{notificacionEnVivo.hora}</strong> · Fecha: {notificacionEnVivo.fecha}
                </p>
                {notificacionEnVivo.observacion && (
                  <p className="mt-1 text-xs text-amber-200 bg-amber-950/60 rounded-lg p-1.5 border border-amber-500/30">
                    <strong>Motivo/Detalle:</strong> {notificacionEnVivo.observacion}
                    {notificacionEnVivo.usuarioRegistro && (
                      <span className="text-slate-400 ml-1">
                        (Autorizado por: {notificacionEnVivo.usuarioRegistro})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {notificacionEnVivo.fotoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setEvidenciaSeleccionada({
                      id: Date.now(),
                      fecha: notificacionEnVivo.fecha,
                      horaEntrada: notificacionEnVivo.tipo === "ENTRADA" ? notificacionEnVivo.hora : null,
                      horaSalida: notificacionEnVivo.tipo === "SALIDA" ? notificacionEnVivo.hora : null,
                      metodo: "EN VIVO",
                      estado: notificacionEnVivo.estado,
                      fotoEntrada: notificacionEnVivo.fotoUrl || null,
                      fotoSalida: null,
                      fotoUrl: notificacionEnVivo.fotoUrl || null,
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-1.5"
                >
                  <span>📸</span>
                  <span>Ver Foto Evidencia</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotificacionEnVivo(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Indicador de conexión SSE discreto */}
        {sseConectado && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl w-fit">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Canal en vivo activo · Las asistencias se actualizan automáticamente</span>
          </div>
        )}

        {/* Selector de Hijas */}
        <SelectorHijas
          estudiantes={datos.estudiantes}
          estudianteActivaId={datos.estudianteActiva.id}
          onSeleccionarHija={handleSeleccionarHija}
        />

        {/* Gráficos y Métricas de la Estudiante */}
        <GraficosPadre
          metricas={datos.metricasEstudiante}
          distribucion={datos.distribucionDona}
          barrasMeses={datos.barrasMeses}
        />

        {/* Tabla Detallada con Botón de Evidencia */}
        <TablaAsistenciasHija
          asistencias={datos.asistencias}
          onVerEvidencia={(asist) => setEvidenciaSeleccionada(asist)}
        />
      </main>

      {/* 3. Modal de Evidencia Fotográfica */}
      <ModalFotoEvidencia
        asistencia={evidenciaSeleccionada}
        nombreEstudiante={`${datos.estudianteActiva.nombres} ${datos.estudianteActiva.apellidos}`}
        onCerrar={() => setEvidenciaSeleccionada(null)}
      />

      {/* 4. Footer del Portal */}
      <footer className="bg-slate-950 text-white border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>
          I.E.P. Santa Rita de Cassia · San Vicente de Cañete, Perú
        </p>
        <p className="text-slate-600 mt-1 text-[11px]">
          Plataforma Segura de Asistencia Escolar · Fotografías y Registros en Tiempo Real
        </p>
      </footer>
    </div>
  );
}
