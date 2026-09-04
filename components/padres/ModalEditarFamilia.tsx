"use client";

import React, { useState, useEffect } from "react";
import { Familia } from "./types";

interface ModalEditarFamiliaProps {
  familia: Familia | null;
  onCerrar: () => void;
  onActualizado: () => void;
}

export function ModalEditarFamilia({
  familia,
  onCerrar,
  onActualizado,
}: ModalEditarFamiliaProps) {
  const [tutorTitular, setTutorTitular] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [correoContacto, setCorreoContacto] = useState("");
  const [estado, setEstado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (familia) {
      setTutorTitular(familia.tutorTitular || "");
      setTelefonoContacto(familia.telefonoContacto || "");
      setCorreoContacto(familia.correoContacto || "");
      setEstado(familia.estado);
      setError("");
    }
  }, [familia]);

  if (!familia) return null;

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError("");

    try {
      const res = await fetch(`/api/padres/${familia?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutorTitular: tutorTitular.trim(),
          telefonoContacto: telefonoContacto.trim(),
          correoContacto: correoContacto.trim(),
          estado,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Error al actualizar familia");
        return;
      }

      onActualizado();
      onCerrar();
    } catch (err) {
      console.error("Error al actualizar familia:", err);
      setError("Error de conexión al servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black flex items-center gap-2">
              <span>✏️</span> Editar Familia
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Código: <span className="font-mono font-bold text-amber-300">{familia.codigo}</span>
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

        <form onSubmit={handleGuardar} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tutor Titular / Apoderado
            </label>
            <input
              type="text"
              value={tutorTitular}
              onChange={(e) => setTutorTitular(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teléfono WhatsApp de Contacto
            </label>
            <input
              type="tel"
              value={telefonoContacto}
              onChange={(e) => setTelefonoContacto(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={correoContacto}
              onChange={(e) => setCorreoContacto(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">Estado del Acceso Web</p>
              <p className="text-[11px] text-slate-500">
                {estado ? "Familia habilitada para ingresar" : "Acceso suspendido temporalmente"}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={estado}
                onChange={(e) => setEstado(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
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
              disabled={guardando}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
