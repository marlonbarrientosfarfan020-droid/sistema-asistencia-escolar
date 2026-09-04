"use client";

import React from "react";
import Image from "next/image";

export interface AsistenciaEvidencia {
  id: number;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  metodo: string;
  estado: string;
  fotoEntrada: string | null;
  fotoSalida: string | null;
  fotoUrl: string | null;
}

interface ModalFotoEvidenciaProps {
  asistencia: AsistenciaEvidencia | null;
  nombreEstudiante: string;
  onCerrar: () => void;
}

export function ModalFotoEvidencia({
  asistencia,
  nombreEstudiante,
  onCerrar,
}: ModalFotoEvidenciaProps) {
  if (!asistencia) return null;

  // Determinar la mejor URL de foto (fotoEntrada, fotoSalida o fotoUrl)
  const urlFoto =
    asistencia.fotoEntrada ||
    asistencia.fotoSalida ||
    asistencia.fotoUrl;

  const fechaFormateada = new Date(asistencia.fecha).toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const horaEntradaStr = asistencia.horaEntrada
    ? new Date(asistencia.horaEntrada).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "No registrada";

  const horaSalidaStr = asistencia.horaSalida
    ? new Date(asistencia.horaSalida).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Sin marcación de salida";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6 animate-in fade-in zoom-in duration-200">
        {/* Cabecera Granate */}
        <div className="bg-gradient-to-r from-slate-950 to-red-950 text-white p-5 flex items-center justify-between border-b-2 border-amber-400">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
              <span>📸</span>
              <span>Evidencia Fotográfica de Portería</span>
            </div>
            <h3 className="text-base font-black text-white truncate max-w-xs">
              {nombreEstudiante}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 leading-none"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo con la Fotografía */}
        <div className="p-6 space-y-4">
          {/* Contenedor de la Foto */}
          <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
            {urlFoto ? (
              <img
                src={urlFoto}
                alt={`Evidencia de asistencia de ${nombreEstudiante}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-8 text-slate-400">
                <span className="text-4xl block mb-2">📷</span>
                <p className="font-bold text-sm">Fotografía no disponible</p>
                <p className="text-xs text-slate-500 mt-1">
                  Este registro fue validado por método manual o biometría sin captura de foto.
                </p>
              </div>
            )}

            {/* Badge superpuesto en la foto */}
            {urlFoto && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-950/80 backdrop-blur-sm px-3 py-1.5 rounded-xl text-white text-xs border border-white/10">
                <span className="font-mono text-[11px] text-amber-300">
                  🕒 {horaEntradaStr}
                </span>
                <span className="font-black text-[10px] uppercase tracking-wider text-emerald-400">
                  {asistencia.metodo} · {asistencia.estado}
                </span>
              </div>
            )}
          </div>

          {/* Ficha de Detalles */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Fecha</p>
              <p className="font-bold text-slate-800 capitalize mt-0.5">
                {fechaFormateada}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Estado de Ingreso</p>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-black text-[10px] uppercase ${
                  asistencia.estado === "PUNTUAL"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                {asistencia.estado}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Hora de Entrada</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {horaEntradaStr}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Hora de Salida</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {horaSalidaStr}
              </p>
            </div>
          </div>

          {/* Pie de autenticidad */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-900">
            <span className="text-base">🛡️</span>
            <span>
              Fotografía capturada automáticamente en portería de la <strong>I.E.P. Santa Rita de Cassia</strong> y respaldada en la nube.
            </span>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
          >
            Cerrar Evidencia
          </button>
        </div>
      </div>
    </div>
  );
}
