"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface MetricasEstudiante {
  totalRegistros: number;
  puntuales: number;
  tardanzas: number;
  justificados?: number;
  faltas?: number;
  porcentajePuntualidad: number;
}

interface DistribucionItem {
  name: string;
  valor: number;
  color: string;
}

interface BarraMesItem {
  mes: string;
  puntuales: number;
  tardanzas: number;
}

interface GraficosPadreProps {
  metricas: MetricasEstudiante;
  distribucion: DistribucionItem[];
  barrasMeses: BarraMesItem[];
}

export function GraficosPadre({
  metricas,
  distribucion,
  barrasMeses,
}: GraficosPadreProps) {
  const presentesTotal = metricas.puntuales + (metricas.justificados || 0);
  const tardanzasTotal = metricas.tardanzas;
  const faltasTotal =
    metricas.faltas !== undefined
      ? metricas.faltas
      : Math.max(0, metricas.totalRegistros - (presentesTotal + tardanzasTotal));

  return (
    <div className="space-y-6">
      {/* Título de la Sección de Métricas del Estudiante */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span>📊</span> Asistencia Mensual y Resumen Escolar
          </h3>
          <p className="text-xs text-slate-500">
            Registro consolidado de cumplimiento y puntualidad en portería.
          </p>
        </div>
        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          {metricas.porcentajePuntualidad}% Puntualidad
        </span>
      </div>

      {/* Tarjetas de Asistencia Mensual Solicitadas: Presentes, Tardanzas, Faltas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Presentes */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Presentes
            </span>
            <span className="text-sm">✅</span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {presentesTotal}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Jornadas a tiempo y justificadas
          </p>
        </div>

        {/* 2. Tardanzas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Tardanzas
            </span>
            <span className="text-sm">⏰</span>
          </div>
          <p className="text-3xl font-black text-amber-600 mt-2">
            {tardanzasTotal}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Ingresos con retraso registrado
          </p>
        </div>

        {/* 3. Faltas / Ausencias */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              Faltas / Inasistencias
            </span>
            <span className="text-sm">❌</span>
          </div>
          <p className="text-3xl font-black text-rose-600 mt-2">
            {faltasTotal}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Días sin marcación de entrada
          </p>
        </div>

        {/* 4. Total Días Evaluados */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Total Días Evaluados
            </span>
            <span className="text-sm">📅</span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {metricas.totalRegistros}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Historial lectivo activo
          </p>
        </div>
      </div>

      {/* Gráficos Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dona de Puntualidad (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🍩</span> Proporción de Puntualidad
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Desglose visual de asistencias puntuales y tardanzas.
            </p>
          </div>

          <div className="h-56 w-full relative my-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribucion}
                  dataKey="valor"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {distribucion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} días`, name]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderRadius: "12px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centro */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">
                {metricas.porcentajePuntualidad}%
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-400">
                Puntual
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-center text-xs">
            {distribucion.map((item) => (
              <div key={item.name} className="p-2 rounded-xl bg-slate-50">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></span>
                  <span className="font-bold text-slate-700">{item.name}</span>
                </div>
                <span className="font-black text-slate-900">{item.valor} días</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barras de Asistencia por Meses (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>📈</span> Evolución de Asistencia Mensual
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro mensual de asistencias puntuales y tardanzas de su hija.
            </p>
          </div>

          <div className="h-56 w-full my-3">
            {barrasMeses.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Aún no hay suficientes registros mensuales acumulados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrasMeses} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="mes"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="puntuales" name="Puntual" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="tardanzas" name="Tardanza" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-2.5 text-center text-[11px] text-slate-500 flex items-center justify-between">
            <span className="font-semibold text-slate-700">
              🌹 Colegio Santa Rita de Cassia
            </span>
            <span className="text-amber-700 font-bold">
              Compromiso y puntualidad formativa
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
