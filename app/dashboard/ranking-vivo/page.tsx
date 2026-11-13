"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

type ClaveTurnoRanking = "MANANA" | "TARDE" | "NOCHE";
type VistaTurnoSelector = "AMBOS" | "MANANA" | "TARDE" | "NOCHE";
type SubTabPanel = "COMPLETO" | "PUNTUALES" | "TARDANZAS" | "SALIDAS";

interface RegistroRankingVivo {
  id: number;
  puesto: number;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  dni: string;
  grado: string;
  seccion: string;
  turnoNombre: string;
  turnoClave: ClaveTurnoRanking;
  horaEntrada: string | null;
  estado: string;
  horaSalida: string | null;
  estadoSalida: string;
  estadoJornada: string;
  metodo: string;
  updatedAt: string;
  tipoMovimiento: "ENTRADA_PUNTUAL" | "ENTRADA_TARDE" | "SALIDA";
}

interface GrupoTurnoRanking {
  turnoClave: ClaveTurnoRanking;
  etiqueta: string;
  horarioReferencia: string;
  totalPresentes: number;
  totalPuntuales: number;
  totalTardanzas: number;
  totalSalidas: number;
  primerosEnLlegar: RegistroRankingVivo[];
  tardanzasTurno: RegistroRankingVivo[];
  salidasTurno: RegistroRankingVivo[];
}

interface RespuestaRankingVivo {
  ok: boolean;
  fecha: string;
  actualizadoEn: string;
  filtros: {
    grado: string;
    seccion: string;
    gradosDisponibles: string[];
    seccionesDisponibles: string[];
    gradosSecciones: { grado: string; seccion: string; etiqueta: string }[];
  };
  resumenGlobal: {
    totalPresentes: number;
    totalPuntuales: number;
    totalTardanzas: number;
    totalSalidas: number;
  };
  turnos: {
    MANANA: GrupoTurnoRanking;
    TARDE: GrupoTurnoRanking;
    NOCHE: GrupoTurnoRanking;
  };
  movimientosEnVivo: RegistroRankingVivo[];
}

function obtenerFechaHoyPeru(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function formatearHoraExacta(iso: string | null): string {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "America/Lima",
    });
  } catch {
    return "--:--";
  }
}

function formatearHoraCorta(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Lima",
    });
  } catch {
    return "-";
  }
}

function medallaPuesto(puesto: number): string {
  if (puesto === 1) return "🥇";
  if (puesto === 2) return "🥈";
  if (puesto === 3) return "🥉";
  return "";
}

const GRUPO_VACIO = (
  clave: ClaveTurnoRanking,
  etiqueta: string,
  horario: string
): GrupoTurnoRanking => ({
  turnoClave: clave,
  etiqueta,
  horarioReferencia: horario,
  totalPresentes: 0,
  totalPuntuales: 0,
  totalTardanzas: 0,
  totalSalidas: 0,
  primerosEnLlegar: [],
  tardanzasTurno: [],
  salidasTurno: [],
});

export default function RankingVivoPage() {
  const [fecha, setFecha] = useState<string>(obtenerFechaHoyPeru);
  const [gradoFiltro, setGradoFiltro] = useState<string>("");
  const [seccionFiltro, setSeccionFiltro] = useState<string>("");
  const [busquedaAlumno, setBusquedaAlumno] = useState<string>("");
  const [vistaTurno, setVistaTurno] = useState<VistaTurnoSelector>("AMBOS");

  const [tabManana, setTabManana] = useState<SubTabPanel>("COMPLETO");
  const [tabTarde, setTabTarde] = useState<SubTabPanel>("COMPLETO");
  const [tabNoche, setTabNoche] = useState<SubTabPanel>("COMPLETO");

  const [datos, setDatos] = useState<RespuestaRankingVivo | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [actualizandoSilencioso, setActualizandoSilencioso] = useState<boolean>(false);
  const [ultimoIdDestacado, setUltimoIdDestacado] = useState<number | null>(null);

  const fetchIdRef = useRef<number>(0);

  const cargarRanking = useCallback(
    async (silencioso = false) => {
      const currentFetch = ++fetchIdRef.current;
      if (!silencioso) {
        setCargando(true);
      } else {
        setActualizandoSilencioso(true);
      }

      try {
        const params = new URLSearchParams({
          fecha,
        });
        if (gradoFiltro) params.set("grado", gradoFiltro);
        if (seccionFiltro) params.set("seccion", seccionFiltro);

        const res = await fetch(`/api/ranking-vivo?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) return;
        const json = (await res.json()) as RespuestaRankingVivo;
        if (currentFetch !== fetchIdRef.current) return;

        if (json.ok) {
          setDatos(json);
          if (json.movimientosEnVivo.length > 0 && silencioso) {
            setUltimoIdDestacado(json.movimientosEnVivo[0].id);
          }
        }
      } catch (error) {
        console.error("Error cargando ranking en vivo:", error);
      } finally {
        if (currentFetch === fetchIdRef.current) {
          setCargando(false);
          setActualizandoSilencioso(false);
        }
      }
    },
    [fecha, gradoFiltro, seccionFiltro]
  );

  useEffect(() => {
    void cargarRanking(false);
  }, [cargarRanking]);

  // Suscripción en tiempo real mediante SSE + Delta Polling de respaldo
  const { conectado, estadoConexion, ultimoEvento, contadorEventos } =
    useRealtimeEvents({
      habilitado: true,
      onAsistencia: () => {
        void cargarRanking(true);
      },
      onSalida: () => {
        void cargarRanking(true);
      },
      onSalidaExcepcional: () => {
        void cargarRanking(true);
      },
      onJornadaIniciada: () => {
        void cargarRanking(true);
      },
      onJornadaCerrada: () => {
        void cargarRanking(true);
      },
    });

  // Refresco periódico ligero cada 12s como respaldo adicional en pantallas de monitoreo
  useEffect(() => {
    const timer = setInterval(() => {
      void cargarRanking(true);
    }, 12000);
    return () => clearInterval(timer);
  }, [cargarRanking]);

  const filtrarPorBusqueda = useCallback(
    (lista: RegistroRankingVivo[]) => {
      const q = busquedaAlumno.trim().toLowerCase();
      if (!q) return lista;
      return lista.filter(
        (item) =>
          item.nombreCompleto.toLowerCase().includes(q) ||
          item.dni.toLowerCase().includes(q) ||
          `${item.grado} - ${item.seccion}`.toLowerCase().includes(q)
      );
    },
    [busquedaAlumno]
  );

  const turnoManana = useMemo(
    () =>
      datos?.turnos.MANANA ||
      GRUPO_VACIO("MANANA", "MAÑANA", "07:30 - 13:00"),
    [datos]
  );

  const turnoTarde = useMemo(
    () =>
      datos?.turnos.TARDE ||
      GRUPO_VACIO("TARDE", "TARDE", "13:00 - 18:00"),
    [datos]
  );

  const turnoNoche = useMemo(
    () =>
      datos?.turnos.NOCHE ||
      GRUPO_VACIO("NOCHE", "NOCHE", "18:30 - 22:30"),
    [datos]
  );

  const movimientosEnVivo = useMemo(
    () => filtrarPorBusqueda(datos?.movimientosEnVivo || []),
    [datos, filtrarPorBusqueda]
  );

  const gradosDisponibles = datos?.filtros.gradosDisponibles || [];
  const seccionesDisponibles = datos?.filtros.seccionesDisponibles || [];

  const hayFiltrosActivos =
    gradoFiltro !== "" || seccionFiltro !== "" || busquedaAlumno.trim() !== "";

  function limpiarFiltros() {
    setGradoFiltro("");
    setSeccionFiltro("");
    setBusquedaAlumno("");
  }

  function renderPanelTurno(
    grupo: GrupoTurnoRanking,
    iconoTurno: string,
    tituloPanel: string,
    acentoGradiente: string,
    bordeColor: string,
    tabActiva: SubTabPanel,
    setTabActiva: (t: SubTabPanel) => void
  ) {
    const puntualesFiltrados = filtrarPorBusqueda(grupo.primerosEnLlegar);
    const tardanzasFiltradas = filtrarPorBusqueda(grupo.tardanzasTurno);
    const salidasFiltradas = filtrarPorBusqueda(grupo.salidasTurno);

    const mostrarPuntuales =
      tabActiva === "COMPLETO" || tabActiva === "PUNTUALES";
    const mostrarTardanzas =
      tabActiva === "COMPLETO" || tabActiva === "TARDANZAS";
    const mostrarSalidas = tabActiva === "SALIDAS";

    return (
      <div
        className={`flex flex-col rounded-3xl border ${bordeColor} bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-xl`}
      >
        {/* Cabecera del Turno */}
        <div className={`p-5 sm:p-6 bg-gradient-to-r ${acentoGradiente} border-b border-slate-800`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/60 border border-white/10 text-2xl shadow-inner">
                {iconoTurno}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    {tituloPanel}
                  </h2>
                  <span className="rounded-full bg-slate-950/70 border border-white/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-200">
                    ⏱️ {grupo.horarioReferencia}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Orden cronológico exacto desde el primer estudiante que ingresó al colegio en el turno {grupo.etiqueta.toLowerCase()}
                </p>
              </div>
            </div>

            {/* Contadores rápidos del turno */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="rounded-2xl bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  Puntuales
                </p>
                <p className="text-lg font-black text-emerald-400 leading-tight">
                  {grupo.totalPuntuales}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-950/80 border border-amber-500/40 px-3 py-1.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Tardanzas
                </p>
                <p className="text-lg font-black text-amber-400 leading-tight">
                  {grupo.totalTardanzas}
                </p>
              </div>
              <div className="rounded-2xl bg-cyan-950/80 border border-cyan-500/40 px-3 py-1.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                  Salidas
                </p>
                <p className="text-lg font-black text-cyan-400 leading-tight">
                  {grupo.totalSalidas}
                </p>
              </div>
            </div>
          </div>

          {/* Selector de Pestañas / Subsecciones del Turno */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTabActiva("COMPLETO")}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition flex items-center gap-1.5 ${tabActiva === "COMPLETO"
                  ? "bg-white text-slate-950 shadow-md"
                  : "bg-slate-950/60 text-slate-300 hover:bg-slate-950 hover:text-white border border-slate-700/70"
                }`}
            >
              <span>📋</span>
              <span>Vista Completa ({grupo.totalPresentes})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("PUNTUALES")}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition flex items-center gap-1.5 ${tabActiva === "PUNTUALES"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50"
                  : "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/40"
                }`}
            >
              <span>🟢</span>
              <span>Primeros en Llegar ({grupo.totalPuntuales})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("TARDANZAS")}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition flex items-center gap-1.5 ${tabActiva === "TARDANZAS"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-950/50"
                  : "bg-amber-950/60 text-amber-300 hover:bg-amber-900/60 border border-amber-500/40"
                }`}
            >
              <span>🟠</span>
              <span>Ingresaron Tarde ({grupo.totalTardanzas})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("SALIDAS")}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition flex items-center gap-1.5 ${tabActiva === "SALIDAS"
                  ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-950/50"
                  : "bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/60 border border-cyan-500/40"
                }`}
            >
              <span>🔵</span>
              <span>Salidas ({grupo.totalSalidas})</span>
            </button>
          </div>
        </div>

        {/* Cuerpo del Panel */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* SUBSECCIÓN A: PRIMEROS EN LLEGAR (PUNTUALES) */}
          {mostrarPuntuales && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-300">
                    🟢 Primeros en Llegar — Puntuales ({puntualesFiltrados.length})
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  Orden #1 → #{puntualesFiltrados.length || 1}
                </span>
              </div>

              {puntualesFiltrados.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center">
                  <p className="text-2xl mb-2">🏁</p>
                  <p className="text-sm font-bold text-slate-300">
                    Aún no hay ingresos puntuales registrados en el Turno {grupo.etiqueta}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    En cuanto el primer estudiante marque su asistencia en portería, aparecerá en el puesto #1 🥇.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3 sm:px-4">Puesto</th>
                        <th className="py-3 px-3 sm:px-4">Apellidos y Nombres</th>
                        <th className="py-3 px-3 text-center">Grado y Sección</th>
                        <th className="py-3 px-3 text-center">Turno</th>
                        <th className="py-3 px-3">Hora Entrada</th>
                        <th className="py-3 px-3 sm:px-4">Hora / Estado Salida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
                      {puntualesFiltrados.map((item) => {
                        const medalla = medallaPuesto(item.puesto);
                        const esPodio = item.puesto <= 3;
                        const esDestacado = ultimoIdDestacado === item.id;

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${esDestacado
                                ? "bg-emerald-500/20 animate-pulse"
                                : esPodio
                                  ? "bg-emerald-950/25 hover:bg-emerald-950/40"
                                  : "hover:bg-slate-900/70"
                              }`}
                          >
                            {/* Puesto */}
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 font-black text-xs sm:text-sm ${item.puesto === 1
                                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm"
                                    : item.puesto === 2
                                      ? "bg-slate-300/20 text-slate-200 border border-slate-300/40"
                                      : item.puesto === 3
                                        ? "bg-orange-400/20 text-orange-300 border border-orange-400/40"
                                        : "bg-slate-800 text-emerald-300 border border-slate-700"
                                  }`}
                              >
                                <span>#{item.puesto}</span>
                                {medalla && <span>{medalla}</span>}
                              </span>
                            </td>

                            {/* Apellidos y Nombres */}
                            <td className="py-3 px-3 sm:px-4">
                              <p className="font-extrabold text-white leading-snug">
                                {item.apellidos}, {item.nombres}
                              </p>
                              <p className="text-[11px] font-mono text-slate-400">
                                DNI: {item.dni} · {item.metodo}
                              </p>
                            </td>

                            {/* Grado y Sección */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="inline-block rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-black text-slate-200">
                                {item.grado} - {item.seccion}
                              </span>
                            </td>

                            {/* Turno */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="inline-block rounded-lg bg-indigo-950/80 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-black uppercase text-indigo-300">
                                {item.turnoNombre}
                              </span>
                            </td>

                            {/* Hora de Entrada */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="inline-flex flex-col">
                                <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm">
                                  🟢 {formatearHoraExacta(item.horaEntrada)}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                                  PUNTUAL
                                </span>
                              </div>
                            </td>

                            {/* Hora / Estado de Salida */}
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              {item.horaSalida ? (
                                <div className="inline-flex flex-col">
                                  <span className="font-mono font-black text-cyan-300 text-xs sm:text-sm">
                                    🔵 {formatearHoraCorta(item.horaSalida)}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                    {item.estadoSalida}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  {item.estadoJornada === "SIN SALIDA"
                                    ? "SIN SALIDA"
                                    : "EN COLEGIO"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBSECCIÓN B: INGRESARON TARDE (INFORMATIVO DEL TURNO) */}
          {mostrarTardanzas && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-amber-500/25 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-300">
                    🟠 Ingresaron Tarde — Informativo {grupo.etiqueta} ({tardanzasFiltradas.length})
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-amber-200/70">
                  Fuera del horario de tolerancia
                </span>
              </div>

              {tardanzasFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 text-center">
                  <p className="text-xs sm:text-sm font-bold text-amber-200/80">
                    ✅ Sin tardanzas registradas en el Turno {grupo.etiqueta} para los filtros actuales.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-amber-500/30 bg-amber-950/15">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-amber-500/20 bg-amber-950/40 text-[11px] font-black uppercase tracking-wider text-amber-200">
                        <th className="py-3 px-3 sm:px-4"># Tarde</th>
                        <th className="py-3 px-3 sm:px-4">Apellidos y Nombres</th>
                        <th className="py-3 px-3 text-center">Grado y Sección</th>
                        <th className="py-3 px-3 text-center">Turno</th>
                        <th className="py-3 px-3">Hora Exacta Entrada</th>
                        <th className="py-3 px-3 sm:px-4">Hora / Estado Salida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/15 text-xs sm:text-sm">
                      {tardanzasFiltradas.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-amber-950/30 transition-colors"
                        >
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 font-black text-xs text-amber-300">
                              ⏰ #{item.puesto}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <p className="font-extrabold text-white leading-snug">
                              {item.apellidos}, {item.nombres}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">
                              DNI: {item.dni} · {item.metodo}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-block rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-black text-slate-200">
                              {item.grado} - {item.seccion}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-block rounded-lg bg-amber-950/80 border border-amber-500/30 px-2.5 py-1 text-[11px] font-black uppercase text-amber-300">
                              {item.turnoNombre}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="inline-flex flex-col">
                              <span className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                                🟠 {formatearHoraExacta(item.horaEntrada)}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                                TARDE
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                            {item.horaSalida ? (
                              <div className="inline-flex flex-col">
                                <span className="font-mono font-black text-cyan-300 text-xs sm:text-sm">
                                  🔵 {formatearHoraCorta(item.horaSalida)}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                  {item.estadoSalida}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {item.estadoJornada === "SIN SALIDA"
                                  ? "SIN SALIDA"
                                  : "EN COLEGIO"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBSECCIÓN C: SALIDAS REGISTRADAS DEL TURNO */}
          {mostrarSalidas && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-cyan-500/25 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-cyan-300">
                    🔵 Salidas Registradas — Turno {grupo.etiqueta} ({salidasFiltradas.length})
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-cyan-200/70">
                  Más recientes primero
                </span>
              </div>

              {salidasFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-6 text-center">
                  <p className="text-xs sm:text-sm font-bold text-cyan-200/80">
                    Aún no se han registrado salidas en el Turno {grupo.etiqueta}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-cyan-500/30 bg-cyan-950/15">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cyan-500/20 bg-cyan-950/40 text-[11px] font-black uppercase tracking-wider text-cyan-200">
                        <th className="py-3 px-3 sm:px-4">Hora Salida</th>
                        <th className="py-3 px-3 sm:px-4">Apellidos y Nombres</th>
                        <th className="py-3 px-3 text-center">Grado y Sección</th>
                        <th className="py-3 px-3">Ingreso</th>
                        <th className="py-3 px-3 sm:px-4">Estado Salida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/15 text-xs sm:text-sm">
                      {salidasFiltradas.map((item) => (
                        <tr key={item.id} className="hover:bg-cyan-950/30">
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap font-mono font-black text-cyan-300">
                            🔵 {formatearHoraExacta(item.horaSalida)}
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <p className="font-extrabold text-white">
                              {item.apellidos}, {item.nombres}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">
                              DNI: {item.dni}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-block rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-black text-slate-200">
                              {item.grado} - {item.seccion}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-300">
                            {formatearHoraCorta(item.horaEntrada)} ({item.estado})
                          </td>
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                            <span className="inline-block rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-[11px] font-black text-cyan-300">
                              {item.estadoSalida}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      {/* CABECERA PRINCIPAL */}
      <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 p-5 sm:p-7 shadow-2xl">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Indicador SSE en Vivo */}
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider border ${conectado
                    ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    : estadoConexion === "conectando"
                      ? "bg-amber-950/90 border-amber-500/50 text-amber-300"
                      : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${conectado
                      ? "bg-emerald-400 animate-ping"
                      : "bg-amber-400 animate-pulse"
                    }`}
                />
                <span>En vivo (SSE)</span>
              </span>

              <span className="rounded-full bg-blue-500/15 border border-blue-400/30 px-3 py-1 text-xs font-bold text-blue-300">
                ⚡ Sincronización instantánea con Portería (/marcar)
              </span>

              {actualizandoSilencioso && (
                <span className="text-xs font-semibold text-cyan-300 animate-pulse">
                  🔄 Actualizando...
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              🏆 Ranking de Llegada en Vivo
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Monitoreo en tiempo real del orden exacto de ingreso (#1, #2, #3...) separado independientemente por{" "}
              <strong className="text-amber-300">Turno Mañana</strong>,{" "}
              <strong className="text-sky-300">Turno Tarde</strong> y{" "}
              <strong className="text-purple-300">Turno Noche</strong>, junto con el registro informativo de tardanzas y salidas.
            </p>
          </div>

          {/* Botones de Acción Rápida */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void cargarRanking(false)}
              className="rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs sm:text-sm font-black text-white transition"
            >
              🔄 Actualizar ahora
            </button>
            <Link
              href="/dashboard/asistencias"
              className="rounded-2xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-blue-950/50 transition"
            >
              ✅ Ir a Asistencias
            </Link>
          </div>
        </div>

        {/* BARRA DE CONTROLES Y FILTROS */}
        <div className="mt-6 pt-5 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Selector de Fecha */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              📅 Fecha de Consulta
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-bold text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Filtro por Grado */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              🎓 Grado
            </label>
            <select
              value={gradoFiltro}
              onChange={(e) => setGradoFiltro(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-bold text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos los grados</option>
              {gradosDisponibles.map((g) => (
                <option key={g} value={g}>
                  Grado {g}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Sección */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              🏫 Sección
            </label>
            <select
              value={seccionFiltro}
              onChange={(e) => setSeccionFiltro(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-bold text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todas las secciones</option>
              {seccionesDisponibles.map((s) => (
                <option key={s} value={s}>
                  Sección {s}
                </option>
              ))}
            </select>
          </div>

          {/* Búsqueda rápida por estudiante o DNI */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              🔎 Buscar Alumno / DNI
            </label>
            <input
              type="text"
              value={busquedaAlumno}
              onChange={(e) => setBusquedaAlumno(e.target.value)}
              placeholder="Apellidos, nombres o DNI..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-bold text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Selector de Vista de Turnos */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              👁️ Modo de Vista
            </label>
            <select
              value={vistaTurno}
              onChange={(e) =>
                setVistaTurno(e.target.value as VistaTurnoSelector)
              }
              className="w-full rounded-2xl border border-blue-500/50 bg-blue-950/40 px-3.5 py-2.5 text-sm font-black text-blue-200 focus:border-blue-400 focus:outline-none"
            >
              <option value="AMBOS" className="bg-slate-900 text-white">
                Ver Mañana y Tarde (Lado a Lado)
              </option>
              <option value="MANANA" className="bg-slate-900 text-white">
                Solo Turno Mañana
              </option>
              <option value="TARDE" className="bg-slate-900 text-white">
                Solo Turno Tarde
              </option>
              <option value="NOCHE" className="bg-slate-900 text-white">
                Solo Turno Noche
              </option>
            </select>
          </div>
        </div>

        {hayFiltrosActivos && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-950/70 border border-slate-800 px-4 py-2 text-xs">
            <span className="text-slate-300">
              Filtros activos:{" "}
              {gradoFiltro && <strong>Grado {gradoFiltro} </strong>}
              {seccionFiltro && <strong>Sección {seccionFiltro} </strong>}
              {busquedaAlumno && <strong>«{busquedaAlumno}»</strong>}
            </span>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="font-black text-rose-400 hover:text-rose-300 underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </header>

      {/* SECCIÓN 1: BARRA EN TIEMPO REAL DE MARCACIONES (ENTRADA PUNTUAL / TARDE / SALIDA) */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-lg">
              📡
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Radar en Tiempo Real de Marcaciones (Entrada y Salida)
              </h2>
              <p className="text-xs text-slate-400">
                Últimos estudiantes que acaban de marcar en portería diferenciados por color según su estado
              </p>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 px-3 py-1 text-emerald-300">
              🟢 ENTRADA PUNTUAL (#Puesto)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/90 border border-amber-500/40 px-3 py-1 text-amber-300">
              🟠 ENTRADA TARDE
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/90 border border-cyan-500/40 px-3 py-1 text-cyan-300">
              🔵 SALIDA REGISTRADA
            </span>
          </div>
        </div>

        {ultimoEvento && (
          <div className="mb-3 rounded-2xl bg-slate-950/90 border border-slate-800 px-4 py-2 text-xs text-slate-300 flex items-center justify-between">
            <span>
              ⚡ Último evento SSE recibido: <strong>{ultimoEvento.tipo}</strong> a las{" "}
              <strong>{ultimoEvento.hora}</strong>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Eventos en sesión: {contadorEventos}
            </span>
          </div>
        )}

        {cargando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-28 rounded-2xl bg-slate-800/50 animate-pulse border border-slate-800"
              />
            ))}
          </div>
        ) : movimientosEnVivo.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
            No se registran marcaciones todavía para la fecha seleccionada ({fecha}).
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {movimientosEnVivo.slice(0, 10).map((mov) => {
              const esSalida = mov.tipoMovimiento === "SALIDA";
              const esTarde = mov.tipoMovimiento === "ENTRADA_TARDE";

              const estiloTarjeta = esSalida
                ? "border-cyan-500/50 bg-gradient-to-br from-cyan-950/60 via-slate-950 to-slate-950 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.12)]"
                : esTarde
                  ? "border-amber-500/50 bg-gradient-to-br from-amber-950/60 via-slate-950 to-slate-950 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                  : "border-emerald-500/50 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]";

              const etiquetaSuperior = esSalida
                ? "🔵 SALIDA REGISTRADA"
                : esTarde
                  ? "🟠 ENTRADA TARDE"
                  : `🟢 ENTRADA PUNTUAL · #${mov.puesto} ${medallaPuesto(mov.puesto)}`;

              const horaMostrada = esSalida
                ? formatearHoraExacta(mov.horaSalida)
                : formatearHoraExacta(mov.horaEntrada);

              return (
                <div
                  key={`${mov.id}-${mov.tipoMovimiento}`}
                  className={`rounded-2xl border p-3.5 transition-all ${estiloTarjeta}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
                    <span className="truncate">{etiquetaSuperior}</span>
                    <span className="rounded-md bg-slate-900/90 px-2 py-0.5 text-slate-200 border border-white/10 shrink-0">
                      {mov.turnoNombre}
                    </span>
                  </div>

                  <p className="mt-2 font-extrabold text-sm text-white truncate">
                    {mov.apellidos}, {mov.nombres}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="rounded-lg bg-slate-900/80 border border-slate-700 px-2 py-0.5 font-black text-slate-200">
                      {mov.grado} - {mov.seccion}
                    </span>
                    <span className="font-mono font-black text-xs">
                      {horaMostrada}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECCIÓN 2: RANKING DE "¿QUIÉNES LLEGARON PRIMERO?" (MAÑANA VS TARDE + NOCHE) */}
      <section
        className={`grid gap-6 ${vistaTurno === "AMBOS"
            ? "grid-cols-1 xl:grid-cols-2"
            : "grid-cols-1"
          }`}
      >
        {/* PANEL 1: TURNO MAÑANA */}
        {(vistaTurno === "AMBOS" || vistaTurno === "MANANA") &&
          renderPanelTurno(
            turnoManana,
            "☀️",
            "RANKING TURNO MAÑANA (Orden de Llegada)",
            "from-emerald-950/80 via-slate-900 to-slate-900",
            "border-emerald-500/30",
            tabManana,
            setTabManana
          )}

        {/* PANEL 2: TURNO TARDE */}
        {(vistaTurno === "AMBOS" || vistaTurno === "TARDE") &&
          renderPanelTurno(
            turnoTarde,
            "🌤️",
            "RANKING TURNO TARDE (Orden de Llegada)",
            "from-sky-950/80 via-slate-900 to-slate-900",
            "border-sky-500/30",
            tabTarde,
            setTabTarde
          )}

        {/* PANEL 3: TURNO NOCHE (Visible cuando se selecciona NOCHE o cuando tiene registros en vista AMBOS) */}
        {(vistaTurno === "NOCHE" ||
          (vistaTurno === "AMBOS" && turnoNoche.totalPresentes > 0)) && (
            <div className={vistaTurno === "AMBOS" ? "xl:col-span-2" : ""}>
              {renderPanelTurno(
                turnoNoche,
                "🌙",
                "RANKING TURNO NOCHE (Orden de Llegada)",
                "from-purple-950/80 via-slate-900 to-slate-900",
                "border-purple-500/30",
                tabNoche,
                setTabNoche
              )}
            </div>
          )}
      </section>
    </div>
  );
}

