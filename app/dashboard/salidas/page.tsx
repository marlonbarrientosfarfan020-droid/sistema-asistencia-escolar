"use client";

import { useEffect, useState, useMemo } from "react";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";

type EstudiantePresente = {
  asistenciaId: number;
  estudianteId: number;
  codigo: string;
  dni: string;
  nombreCompleto: string;
  grado: string;
  seccion: string;
  nombreTutor: string;
  turno: string;
  horaEntrada: string | null;
  estadoEntrada: string;
};

type SalidaExcepcional = {
  id: number;
  asistenciaId: number;
  estudianteId: number;
  codigo: string;
  dni: string;
  estudiante: string;
  grado: string;
  seccion: string;
  tutor: string;
  turno: string;
  horaEntrada: string;
  horaSalida: string;
  motivo: string;
  motivoEtiqueta: string;
  motivoDetalle: string | null;
  observacion: string;
  usuarioRegistro: string;
  createdAt: string;
};

const MOTIVOS_CATALOGO = [
  { id: "PROBLEMA_SALUD", nombre: "Problema de salud", icono: "🩺", color: "border-rose-500/40 bg-rose-950/20 text-rose-300" },
  { id: "ACCIDENTE_ESCOLAR", nombre: "Accidente escolar", icono: "🩹", color: "border-orange-500/40 bg-orange-950/20 text-orange-300" },
  { id: "CITA_MEDICA", nombre: "Cita médica", icono: "🏥", color: "border-blue-500/40 bg-blue-950/20 text-blue-300" },
  { id: "EMERGENCIA_FAMILIAR", nombre: "Emergencia familiar", icono: "🚨", color: "border-amber-500/40 bg-amber-950/20 text-amber-300" },
  { id: "RETIRO_AUTORIZADO", nombre: "Retiro autorizado por apoderado", icono: "👨‍👩‍👧", color: "border-purple-500/40 bg-purple-950/20 text-purple-300" },
  { id: "OTRO", nombre: "Otro motivo", icono: "✍️", color: "border-slate-500/40 bg-slate-800/40 text-slate-300" },
];

function fechaHoyPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function GestionSalidasPage() {
  const { configuracion } = useConfiguracionColegio();

  const [fecha, setFecha] = useState(fechaHoyPeru());
  const [salidas, setSalidas] = useState<SalidaExcepcional[]>([]);
  const [presentes, setPresentes] = useState<EstudiantePresente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Estados del modal de registro
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busquedaAlumna, setBusquedaAlumna] = useState("");
  const [alumnaSeleccionada, setAlumnaSeleccionada] = useState<EstudiantePresente | null>(null);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<string>("PROBLEMA_SALUD");
  const [motivoDetalle, setMotivoDetalle] = useState("");
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Filtros de la tabla
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState("TODOS");

  async function cargarDatos() {
    setCargando(true);
    try {
      const [resSalidas, resPresentes] = await Promise.all([
        fetch(`/api/salidas-excepcionales?fecha=${fecha}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/salidas-excepcionales?fecha=${fecha}&presentes=true`, { cache: "no-store", credentials: "include" }),
      ]);

      const dataSalidas = await resSalidas.json();
      const dataPresentes = await resPresentes.json();

      if (dataSalidas.ok) {
        setSalidas(dataSalidas.salidas || []);
      }
      if (dataPresentes.ok) {
        setPresentes(dataPresentes.estudiantes || []);
      }
    } catch (err) {
      console.error("Error al cargar datos de salidas:", err);
      setMensaje({ tipo: "error", texto: "No se pudieron cargar los datos de salidas del servidor." });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [fecha]);

  // Alumnas disponibles para salida filtradas por el buscador del modal
  const alumnasFiltradasModal = useMemo(() => {
    if (!busquedaAlumna.trim()) return presentes.slice(0, 10);
    const q = busquedaAlumna.toLowerCase();
    return presentes.filter(
      (a) =>
        a.nombreCompleto.toLowerCase().includes(q) ||
        a.dni.includes(q) ||
        a.codigo.toLowerCase().includes(q) ||
        `${a.grado} ${a.seccion}`.toLowerCase().includes(q)
    );
  }, [presentes, busquedaAlumna]);

  // Salidas mostradas en la tabla principal
  const salidasFiltradasTabla = useMemo(() => {
    return salidas.filter((s) => {
      const cumpleMotivo = filtroMotivo === "TODOS" || s.motivo === filtroMotivo;
      const q = filtroTexto.toLowerCase();
      const cumpleTexto =
        !filtroTexto.trim() ||
        s.estudiante.toLowerCase().includes(q) ||
        s.dni.includes(q) ||
        s.codigo.toLowerCase().includes(q) ||
        s.observacion.toLowerCase().includes(q);
      return cumpleMotivo && cumpleTexto;
    });
  }, [salidas, filtroMotivo, filtroTexto]);

  // Manejador del guardado
  async function handleGuardarSalida(e: React.FormEvent) {
    e.preventDefault();
    if (!alumnaSeleccionada) {
      alert("Por favor seleccione una estudiante para registrar su salida.");
      return;
    }

    if (motivoSeleccionado === "OTRO" && motivoDetalle.trim().length < 3) {
      alert("Por favor detalle el motivo en el campo correspondiente (mínimo 3 caracteres).");
      return;
    }

    if (observacion.trim().length < 5) {
      alert("La observación es obligatoria y debe tener al menos 5 caracteres descriptivos.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    try {
      const res = await fetch("/api/salidas-excepcionales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          estudianteId: alumnaSeleccionada.estudianteId,
          motivo: motivoSeleccionado,
          motivoDetalle: motivoSeleccionado === "OTRO" ? motivoDetalle.trim() : null,
          observacion: observacion.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Error al registrar la salida excepcional");
      }

      setMensaje({ tipo: "exito", texto: data.message });
      setModalAbierto(false);
      setAlumnaSeleccionada(null);
      setMotivoSeleccionado("PROBLEMA_SALUD");
      setMotivoDetalle("");
      setObservacion("");
      setBusquedaAlumna("");
      await cargarDatos();
    } catch (err: any) {
      alert(`❌ ${err.message || "Error inesperado al registrar salida"}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Cabecera Principal */}
      <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl border border-amber-400/30">
                🚪
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Gestión de Salidas Excepcionales
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                  I.E. Santa Rita de Casia · Registro y control de retiros autorizados (Salud, accidentes, citas médicas y retiro de apoderados)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-200 shadow-sm focus:border-amber-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setModalAbierto(true);
                setAlumnaSeleccionada(null);
                setObservacion("");
                setBusquedaAlumna("");
              }}
              className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm px-5 py-2.5 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition active:scale-95"
            >
              <span>➕</span>
              <span>Registrar Salida Excepcional</span>
            </button>
          </div>
        </div>
      </header>

      {/* Alertas de Notificación */}
      {mensaje && (
        <div
          className={`rounded-2xl border p-4 text-xs sm:text-sm font-bold flex items-center justify-between ${
            mensaje.tipo === "exito"
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
              : "border-rose-500/40 bg-rose-950/40 text-rose-200"
          }`}
        >
          <span>{mensaje.texto}</span>
          <button type="button" onClick={() => setMensaje(null)} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Tarjetas KPI de Estado */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Salidas Excepcionales</span>
            <span className="text-xl">⚠️</span>
          </div>
          <p className="mt-3 text-3xl font-black text-white">{salidas.length}</p>
          <p className="mt-1 text-[11px] text-slate-400">Alumnas retiradas con autorización hoy</p>
        </div>

        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">En el Colegio (Activas)</span>
            <span className="text-xl">🏫</span>
          </div>
          <p className="mt-3 text-3xl font-black text-white">{presentes.length}</p>
          <p className="mt-1 text-[11px] text-slate-400">Jornada abierta disponible para salida</p>
        </div>

        <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-blue-400">Condición Asistencia</span>
            <span className="text-xl">✅</span>
          </div>
          <p className="mt-3 text-xl font-black text-white">100% Presentes</p>
          <p className="mt-1 text-[11px] text-slate-400">No computa falta ni afecta puntualidad</p>
        </div>

        <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/30 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-purple-400">Trazabilidad</span>
            <span className="text-xl">📋</span>
          </div>
          <p className="mt-3 text-xl font-black text-white">Auditoría Total</p>
          <p className="mt-1 text-[11px] text-slate-400">Con motivo y responsable institucional</p>
        </div>
      </section>

      {/* Tabla de Salidas Excepcionales Registradas */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <div className="border-b border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>📋</span> Registro Histórico del Día
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Listado oficial de estudiantes con salida excepcional autorizada
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="Buscar por alumna, DNI..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
            <select
              value={filtroMotivo}
              onChange={(e) => setFiltroMotivo(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="TODOS">Todos los motivos</option>
              {MOTIVOS_CATALOGO.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={cargarDatos}
              className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 transition"
            >
              🔄 Refrescar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Hora Salida</th>
                <th className="py-3.5 px-4">Estudiante</th>
                <th className="py-3.5 px-4">Grado y Sección</th>
                <th className="py-3.5 px-4">Entrada</th>
                <th className="py-3.5 px-4">Motivo Oficial</th>
                <th className="py-3.5 px-4">Observación / Justificación</th>
                <th className="py-3.5 px-4">Autorizado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <span className="animate-spin text-xl inline-block mr-2">⏳</span> Cargando registros...
                  </td>
                </tr>
              ) : salidasFiltradasTabla.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="text-3xl mb-2">🚪</div>
                    <p className="font-bold text-sm text-slate-400">No hay salidas excepcionales registradas para esta fecha</p>
                    <p className="text-xs text-slate-600 mt-1">Utilice el botón superior para registrar una salida cuando sea necesario.</p>
                  </td>
                </tr>
              ) : (
                salidasFiltradasTabla.map((s) => {
                  const catalogoInfo = MOTIVOS_CATALOGO.find((m) => m.id === s.motivo);
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-black text-amber-300">
                        {s.horaSalida}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white">{s.estudiante}</p>
                        <p className="text-[10px] text-slate-400 font-mono">DNI: {s.dni} · Cód: {s.codigo}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {s.grado}° &quot;{s.seccion}&quot;
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{s.turno}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {s.horaEntrada}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            catalogoInfo?.color || "border-slate-700 bg-slate-800 text-slate-300"
                          }`}
                        >
                          <span>{catalogoInfo?.icono || "⚠️"}</span>
                          <span>{s.motivoEtiqueta}</span>
                        </span>
                        {s.motivoDetalle && (
                          <p className="text-[10px] text-slate-400 italic mt-1">&quot;{s.motivoDetalle}&quot;</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-300 font-medium line-clamp-2">{s.observacion}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-300 text-[11px]">👤 {s.usuarioRegistro}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Registro de Salida Excepcional */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-xl border border-amber-400/30">
                  🚪
                </span>
                <div>
                  <h3 className="text-lg font-black text-white">Registrar Salida Excepcional</h3>
                  <p className="text-xs text-slate-400">Autorización formal de retiro anticipado de estudiante</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarSalida} className="space-y-5">
              {/* Paso 1: Seleccionar Estudiante */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
                  1. Seleccionar Estudiante con Ingreso Hoy:
                </label>
                {!alumnaSeleccionada ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Escriba el nombre, apellido o DNI de la alumna..."
                      value={busquedaAlumna}
                      onChange={(e) => setBusquedaAlumna(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 max-h-44 overflow-y-auto divide-y divide-slate-800/80">
                      {alumnasFiltradasModal.length === 0 ? (
                        <p className="p-3 text-center text-xs text-slate-500">
                          {presentes.length === 0
                            ? "No hay alumnas con ingreso registrado hoy en el colegio."
                            : "No se encontraron coincidencias."}
                        </p>
                      ) : (
                        alumnasFiltradasModal.map((a) => (
                          <button
                            key={a.estudianteId}
                            type="button"
                            onClick={() => setAlumnaSeleccionada(a)}
                            className="w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-800/80 transition"
                          >
                            <div>
                              <p className="font-bold text-white text-xs">{a.nombreCompleto}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {a.grado}° &quot;{a.seccion}&quot; · DNI: {a.dni} · Entrada: {a.horaEntrada}
                              </p>
                            </div>
                            <span className="text-xs text-amber-400 font-bold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                              Seleccionar ➔
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{alumnaSeleccionada.nombreCompleto}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {alumnaSeleccionada.grado}° &quot;{alumnaSeleccionada.seccion}&quot;
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 font-mono">
                        DNI: <strong>{alumnaSeleccionada.dni}</strong> · Hora Entrada: <strong>{alumnaSeleccionada.horaEntrada}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tutor: {alumnaSeleccionada.nombreTutor || "Sin tutor registrado"} · Turno: {alumnaSeleccionada.turno}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlumnaSeleccionada(null)}
                      className="text-xs text-slate-400 hover:text-rose-400 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900"
                    >
                      Cambiar ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Paso 2: Motivo de Salida */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
                  2. Motivo de la Salida Excepcional:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {MOTIVOS_CATALOGO.map((m) => {
                    const esSeleccionado = motivoSeleccionado === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMotivoSeleccionado(m.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                          esSeleccionado
                            ? "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400 shadow-md"
                            : "border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <span className="text-xl mb-1">{m.icono}</span>
                        <span className="text-xs font-bold leading-tight text-white">{m.nombre}</span>
                      </button>
                    );
                  })}
                </div>

                {motivoSeleccionado === "OTRO" && (
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-amber-300 mb-1">
                      Especifique el motivo puntual (obligatorio):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Trámite de DNI en RENIEC con cita comprobada..."
                      value={motivoDetalle}
                      onChange={(e) => setMotivoDetalle(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Paso 3: Observación Manual Libre */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                    3. Observación y Justificación Detallada (Obligatorio):
                  </label>
                  <span className="text-[10px] text-slate-500">Mínimo 5 caracteres ({observacion.length})</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Ej. Estudiante presentó fiebre y dolor de cabeza. Se comunicó a la madre quien autorizó su retiro inmediato..."
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none resize-none font-sans"
                />
              </div>

              {/* Información de Garantía de Asistencia */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-950/30 p-3.5 text-xs text-blue-200 flex items-start gap-2.5">
                <span className="text-base">ℹ️</span>
                <p className="leading-relaxed">
                  <strong>Regla institucional de Santa Rita de Casia:</strong> La salida excepcional cerrará la jornada escolar en base de datos registrando la hora de retiro, pero mantendrá la condición de <strong>PRESENTE</strong> de la estudiante sin generar falta ni tardanza.
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setModalAbierto(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !alumnaSeleccionada}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs px-5 py-2 shadow-lg shadow-amber-500/20 transition"
                >
                  {guardando ? "Registrando..." : "Confirmar Salida Excepcional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
