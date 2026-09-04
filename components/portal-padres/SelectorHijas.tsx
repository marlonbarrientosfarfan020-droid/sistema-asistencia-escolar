"use client";

import React from "react";

export interface EstudianteHija {
  id: number;
  codigo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;
  turno?: {
    nombre: string;
    horaEntrada: string;
    horaSalida: string;
  } | null;
}

interface SelectorHijasProps {
  estudiantes: EstudianteHija[];
  estudianteActivaId: number;
  onSeleccionarHija: (id: number) => void;
}

export function SelectorHijas({
  estudiantes,
  estudianteActivaId,
  onSeleccionarHija,
}: SelectorHijasProps) {
  const activaEst =
    estudiantes.find((e) => e.id === estudianteActivaId) || estudiantes[0];

  if (!activaEst) return null;

  return (
    <div className="space-y-4">
      {/* Selector si la familia tiene múltiples hijas */}
      {estudiantes.length > 1 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>👩‍👧‍👧</span>
              <span>Seleccione la Hija a Consultar ({estudiantes.length} registradas)</span>
            </span>
            <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Hermanas Vinculadas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {estudiantes.map((est) => {
              const activa = est.id === estudianteActivaId;
              return (
                <button
                  type="button"
                  key={est.id}
                  onClick={() => onSeleccionarHija(est.id)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition border text-left flex items-center justify-between gap-3 ${
                    activa
                      ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-400/50"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-black text-xs sm:text-sm truncate">
                      {est.nombres.split(" ")[0]} {est.apellidos.split(" ")[0]}
                    </p>
                    <p className={`text-[10px] truncate ${activa ? "text-slate-300" : "text-slate-400"}`}>
                      DNI: {est.dni}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-xl ${
                      activa
                        ? "bg-amber-400 text-slate-950 font-black"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {est.grado}-{est.seccion}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ficha Principal de la Estudiante Seleccionada (Nombre, Grado, Sección, Turno) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-900 to-red-950 text-amber-300 border-2 border-amber-400/50 flex items-center justify-center text-3xl font-black shadow-lg shadow-red-950/20">
            👩‍🎓
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200">
                Grado: {activaEst.grado}
              </span>
              <span className="text-xs font-black uppercase text-red-800 bg-red-100/70 px-2.5 py-0.5 rounded-full border border-red-200">
                Sección: &quot;{activaEst.seccion}&quot;
              </span>
              {activaEst.turno && (
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Turno {activaEst.turno.nombre}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mt-1">
              {activaEst.apellidos}, {activaEst.nombres}
            </h2>

            <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-3">
              <span><strong>DNI:</strong> {activaEst.dni}</span>
              <span>•</span>
              <span><strong>Código Estudiante:</strong> {activaEst.codigo}</span>
            </p>
          </div>
        </div>

        {activaEst.turno && (
          <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 text-xs self-start sm:self-center shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
              Horario Oficial de Asistencia
            </span>
            <div className="flex items-center gap-2 font-mono font-bold text-slate-900">
              <span>⏰ Entrada: {activaEst.turno.horaEntrada}</span>
              <span>•</span>
              <span>Salida: {activaEst.turno.horaSalida}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
