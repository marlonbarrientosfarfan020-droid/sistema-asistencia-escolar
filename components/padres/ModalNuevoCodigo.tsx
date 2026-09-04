"use client";

import React, { useState, useMemo } from "react";
import { EstudianteBasico, Familia } from "./types";

interface ModalNuevoCodigoProps {
  abierto: boolean;
  onCerrar: () => void;
  estudiantesSinCodigo: EstudianteBasico[];
  onCreado: (nuevaFamilia: Familia) => void;
}

export function ModalNuevoCodigo({
  abierto,
  onCerrar,
  estudiantesSinCodigo,
  onCreado,
}: ModalNuevoCodigoProps) {
  const [tutorTitular, setTutorTitular] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [correoContacto, setCorreoContacto] = useState("");
  const [codigoPersonalizado, setCodigoPersonalizado] = useState("");
  const [usarPersonalizado, setUsarPersonalizado] = useState(false);
  const [estudiantesSeleccionadas, setEstudiantesSeleccionadas] = useState<number[]>([]);
  const [filtroEstudiante, setFiltroEstudiante] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Filtrar estudiantes sin código para el buscador
  const estudiantesFiltradas = useMemo(() => {
    if (!filtroEstudiante.trim()) return estudiantesSinCodigo.slice(0, 20);
    const busq = filtroEstudiante.toLowerCase();
    return estudiantesSinCodigo
      .filter(
        (e) =>
          e.nombres.toLowerCase().includes(busq) ||
          e.apellidos.toLowerCase().includes(busq) ||
          e.dni.includes(busq) ||
          `${e.grado} ${e.seccion}`.toLowerCase().includes(busq)
      )
      .slice(0, 30);
  }, [estudiantesSinCodigo, filtroEstudiante]);

  if (!abierto) return null;

  function toggleEstudiante(id: number) {
    if (estudiantesSeleccionadas.includes(id)) {
      setEstudiantesSeleccionadas((prev) => prev.filter((item) => item !== id));
    } else {
      setEstudiantesSeleccionadas((prev) => [...prev, id]);

      // Si el tutor está vacío, intentar autocompletar con el del estudiante
      const est = estudiantesSinCodigo.find((e) => e.id === id);
      if (est) {
        if (!tutorTitular && est.nombreTutor) setTutorTitular(est.nombreTutor);
        if (!telefonoContacto && est.whatsapp) setTelefonoContacto(est.whatsapp);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (estudiantesSeleccionadas.length === 0 && !tutorTitular.trim()) {
      setError("Seleccione al menos una estudiante o indique el nombre del tutor titular.");
      return;
    }

    setGuardando(true);

    try {
      const res = await fetch("/api/padres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutorTitular: tutorTitular.trim(),
          telefonoContacto: telefonoContacto.trim(),
          correoContacto: correoContacto.trim(),
          codigoPersonalizado: usarPersonalizado ? codigoPersonalizado.trim() : undefined,
          estudianteIds: estudiantesSeleccionadas,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Error al generar código familiar");
        return;
      }

      onCreado(data.familia);
      onCerrar();
    } catch (err) {
      console.error("Error al guardar código familiar:", err);
      setError("Error de conexión al servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2">
              <span>👨‍👩‍👧</span> Generar Código Familiar
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Cree un acceso único para padres y vincule una o varias hermanas.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-2xl font-bold p-1 leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Datos del Tutor / Contacto */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              1. Datos del Apoderado / Tutor Titular
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Tutor Titular
                </label>
                <input
                  type="text"
                  value={tutorTitular}
                  onChange={(e) => setTutorTitular(e.target.value)}
                  placeholder="Ej: Juan Carlos Pérez Gómez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teléfono / WhatsApp de Contacto
                </label>
                <input
                  type="tel"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  placeholder="Ej: 987654321"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  value={correoContacto}
                  onChange={(e) => setCorreoContacto(e.target.value)}
                  placeholder="padre@correo.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Formato de Código */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Código de Acceso
                </p>
                <p className="text-xs text-slate-500">
                  {usarPersonalizado
                    ? "Definir código manualmente (debe ser único)"
                    : "Autogeneración segura (Formato: SR-2026-XXXX)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUsarPersonalizado(!usarPersonalizado)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
              >
                {usarPersonalizado ? "Usar autogenerado" : "Personalizar"}
              </button>
            </div>

            {usarPersonalizado && (
              <div className="mt-3">
                <input
                  type="text"
                  value={codigoPersonalizado}
                  onChange={(e) => setCodigoPersonalizado(e.target.value.toUpperCase())}
                  placeholder="Ej: SR-2026-AB12"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Selección de Hermanas / Estudiantes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                2. Vincular Alumnas / Hijas ({estudiantesSeleccionadas.length} seleccionadas)
              </h4>
              <span className="text-xs text-slate-400">
                {estudiantesSinCodigo.length} disponibles
              </span>
            </div>

            {/* Buscador de estudiantes */}
            <input
              type="text"
              value={filtroEstudiante}
              onChange={(e) => setFiltroEstudiante(e.target.value)}
              placeholder="🔍 Buscar por nombre, apellidos o DNI..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Lista scrolleable de estudiantes */}
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-2 space-y-1 divide-y divide-slate-100">
              {estudiantesFiltradas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No se encontraron estudiantes sin código familiar
                </p>
              ) : (
                estudiantesFiltradas.map((est) => {
                  const seleccionada = estudiantesSeleccionadas.includes(est.id);
                  return (
                    <div
                      key={est.id}
                      onClick={() => toggleEstudiante(est.id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition text-xs ${
                        seleccionada
                          ? "bg-blue-50 border border-blue-200 font-bold"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-0"
                        />
                        <div className="truncate">
                          <p className="text-slate-900 truncate">
                            {est.apellidos}, {est.nombres}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            DNI: {est.dni} · {est.grado} &quot;{est.seccion}&quot;
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        {est.grado}-{est.seccion}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {guardando ? (
                <>
                  <span className="animate-spin text-xs">⏳</span>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Generar Código Familiar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
