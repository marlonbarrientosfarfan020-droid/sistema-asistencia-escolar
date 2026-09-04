"use client";

import React, { useState, useMemo } from "react";
import { EstudianteBasico, Familia } from "./types";

interface ModalVincularHermanaProps {
  familia: Familia | null;
  onCerrar: () => void;
  estudiantesSinCodigo: EstudianteBasico[];
  onVinculada: () => void;
}

export function ModalVincularHermana({
  familia,
  onCerrar,
  estudiantesSinCodigo,
  onVinculada,
}: ModalVincularHermanaProps) {
  const [estudianteId, setEstudianteId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return estudiantesSinCodigo.slice(0, 25);
    const q = busqueda.toLowerCase();
    return estudiantesSinCodigo
      .filter(
        (e) =>
          e.nombres.toLowerCase().includes(q) ||
          e.apellidos.toLowerCase().includes(q) ||
          e.dni.includes(q)
      )
      .slice(0, 30);
  }, [estudiantesSinCodigo, busqueda]);

  if (!familia) return null;

  async function handleVincular(e: React.FormEvent) {
    e.preventDefault();
    if (!estudianteId) {
      setError("Seleccione una estudiante para vincular.");
      return;
    }

    setGuardando(true);
    setError("");

    try {
      const res = await fetch(`/api/padres/${familia?.id}/estudiantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estudianteId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Error al vincular estudiante");
        return;
      }

      onVinculada();
      onCerrar();
    } catch (err) {
      console.error("Error vinculando hermana:", err);
      setError("Error de conexión al servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black flex items-center gap-2">
              <span>🔗</span> Vincular Hermana
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Familia: <span className="font-mono font-bold text-amber-300">{familia.codigo}</span> · {familia.tutorTitular || "Sin tutor"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleVincular} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Buscar Alumna sin Código Familiar
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar por apellidos, nombres o DNI..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-1.5 space-y-1">
              {filtradas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No hay estudiantes pendientes disponibles
                </p>
              ) : (
                filtradas.map((est) => {
                  const activa = estudianteId === est.id;
                  return (
                    <div
                      key={est.id}
                      onClick={() => setEstudianteId(est.id)}
                      className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs ${
                        activa
                          ? "bg-blue-600 text-white font-bold"
                          : "hover:bg-slate-100 text-slate-800"
                      }`}
                    >
                      <div>
                        <p className="truncate">
                          {est.apellidos}, {est.nombres}
                        </p>
                        <p className={`text-[10px] ${activa ? "text-blue-100" : "text-slate-400"}`}>
                          DNI: {est.dni}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          activa
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {est.grado}&quot;{est.seccion}&quot;
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !estudianteId}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition disabled:opacity-50"
            >
              {guardando ? "Vinculando..." : "Vincular a esta Familia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
