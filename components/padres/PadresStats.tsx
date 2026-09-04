"use client";

import React from "react";
import { EstadisticasPadres } from "./types";

interface PadresStatsProps {
  estadisticas: EstadisticasPadres | null;
  cargando: boolean;
}

export function PadresStats({ estadisticas, cargando }: PadresStatsProps) {
  if (cargando || !estadisticas) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-2xl border border-slate-200"></div>
        ))}
      </div>
    );
  }

  const porcentajeCobertura =
    estadisticas.totalEstudiantes > 0
      ? Math.round(
          (estadisticas.alumnasVinculadas / estadisticas.totalEstudiantes) * 100
        )
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Familias Registradas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Familias Registradas
          </p>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {estadisticas.totalFamilias}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Códigos únicos emitidos
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
          👨‍👩‍👧
        </div>
      </div>

      {/* 2. Cobertura de Alumnas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Alumnas Vinculadas
            </p>
            <p className="text-3xl font-black text-slate-900 mt-1">
              {estadisticas.alumnasVinculadas}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {estadisticas.totalEstudiantes}
              </span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
            🎓
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-emerald-700">Cobertura escolar</span>
            <span className="text-slate-700">{porcentajeCobertura}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${porcentajeCobertura}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 3. Alumnas Sin Código */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pendientes de Código
          </p>
          <p className="text-3xl font-black text-amber-600 mt-1">
            {estadisticas.alumnasSinCodigo}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Alumnas sin código familiar
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl">
          ⏳
        </div>
      </div>

      {/* 4. Estado de Códigos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Estado de Códigos
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-black text-emerald-600">
              {estadisticas.familiasActivas}
              <span className="text-xs font-bold text-slate-500 ml-1">act.</span>
            </span>
            <span className="text-slate-300 font-light">|</span>
            <span className="text-2xl font-black text-slate-400">
              {estadisticas.familiasInactivas}
              <span className="text-xs font-bold text-slate-500 ml-1">inact.</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Habilitados para el portal
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-2xl">
          🔐
        </div>
      </div>
    </div>
  );
}
