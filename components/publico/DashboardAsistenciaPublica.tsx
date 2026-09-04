"use client";

import React, { useEffect, useState } from "react";
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
  AreaChart,
  Area,
} from "recharts";

interface MetricasGlobales {
  totalMatriculadas: number;
  presentes: number;
  puntuales: number;
  tardanzas: number;
  justificados: number;
  ausentes: number;
  porcentajeAsistencia: number;
  porcentajePuntualidad: number;
}

interface DistribucionItem {
  name: string;
  valor: number;
  color: string;
}

interface TurnoItem {
  turno: string;
  icono?: string;
  porcentaje: number;
  presentes: number;
  puntuales: number;
  tardanzas: number;
  ausentes?: number;
  totalAlumnas: number;
}

interface EvolucionSemanalItem {
  semana: string;
  asistencia: number;
  puntualidad: number;
}

interface DatosPublicos {
  fechaConsulta: string;
  asistenciaGeneral?: MetricasGlobales;
  metricasGlobales?: MetricasGlobales;
  presentes?: number;
  tardanzas?: number;
  ausentes?: number;
  porcentajeAsistencia?: number;
  porcentajePuntualidad?: number;
  distribucionDona: DistribucionItem[];
  distribucionPorTurnos?: {
    manana: TurnoItem;
    tarde: TurnoItem;
    noche: TurnoItem;
  };
  asistenciaPorTurno?: TurnoItem[];
  evolucionSemanal?: EvolucionSemanalItem[];
}

export function DashboardAsistenciaPublica() {
  const [datos, setDatos] = useState<DatosPublicos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargarMetricas() {
      try {
        const res = await fetch("/api/publica/asistencia", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const json = await res.json();
            if (activo && json && json.ok !== false) {
              setDatos(json);
              return;
            }
          }
        }
      } catch (err) {
        // En caso de latencia inicial o reconexión
        console.warn("Aviso al sincronizar métricas públicas:", err);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarMetricas();

    return () => {
      activo = false;
    };
  }, []);

  if (cargando) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-xl">
          <span className="animate-spin text-2xl">⏳</span>
          <div className="text-left">
            <span className="block font-black text-sm text-amber-400">
              Sincronizando Plataforma Escolar...
            </span>
            <span className="text-xs text-slate-400">
              Consultando métricas en tiempo real de I.E.P. Santa Rita de Cassia
            </span>
          </div>
        </div>
      </div>
    );
  }

  const fallbackMetricas: MetricasGlobales = {
    totalMatriculadas: 0,
    presentes: 0,
    puntuales: 0,
    tardanzas: 0,
    justificados: 0,
    ausentes: 0,
    porcentajeAsistencia: 0,
    porcentajePuntualidad: 0,
  };

  const metricas = datos?.asistenciaGeneral || datos?.metricasGlobales || fallbackMetricas;
  const distribucion = datos?.distribucionDona && datos.distribucionDona.length > 0 ? datos.distribucionDona : [
    { name: "Presentes (Puntual)", valor: 0, color: "#10B981" },
    { name: "Tardanzas", valor: 0, color: "#F59E0B" },
    { name: "Faltas / Ausencias", valor: 0, color: "#EF4444" },
  ];
  const turnos = datos?.asistenciaPorTurno && datos.asistenciaPorTurno.length > 0 ? datos.asistenciaPorTurno : [
    { turno: "Mañana", icono: "🌅", porcentaje: 0, presentes: 0, puntuales: 0, tardanzas: 0, ausentes: 0, totalAlumnas: 0 },
    { turno: "Tarde", icono: "🌞", porcentaje: 0, presentes: 0, puntuales: 0, tardanzas: 0, ausentes: 0, totalAlumnas: 0 },
    { turno: "Noche", icono: "🌙", porcentaje: 0, presentes: 0, puntuales: 0, tardanzas: 0, ausentes: 0, totalAlumnas: 0 },
  ];
  const evolucion = datos?.evolucionSemanal && datos.evolucionSemanal.length > 0 ? datos.evolucionSemanal : [
    { semana: "Semana 1", asistencia: 0, puntualidad: 0 },
    { semana: "Semana 2", asistencia: 0, puntualidad: 0 },
    { semana: "Semana 3", asistencia: 0, puntualidad: 0 },
    { semana: "Semana 4", asistencia: 0, puntualidad: 0 },
  ];

  return (
    <div className="space-y-6 sm:space-y-10 w-full overflow-hidden">
      {/* Cabecera del Módulo de Métricas */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-4 sm:pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] sm:text-xs font-black tracking-wide uppercase mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Monitoreo en Tiempo Real
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Métricas Públicas de Asistencia Escolar
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm lg:text-base mt-1">
            Transparencia institucional consolidada para la comunidad educativa ({datos?.fechaConsulta ? new Date(`${datos.fechaConsulta}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Jornada de Hoy"})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 shrink-0">
          <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 text-slate-900 flex items-center gap-1.5 text-xs">
            <span>👥</span>
            <span>{metricas?.totalMatriculadas ?? 0} Estudiantes</span>
          </div>
          <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 font-black text-xs">
            <span>📈</span>
            <span>{metricas?.porcentajeAsistencia ?? 0}% Asistencia</span>
          </div>
        </div>
      </div>

      {/* 4 KPIs Principales (2 columnas en móvil, 4 en desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* 1. Asistencia General */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-400 hover:shadow-md transition flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-emerald-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
          <div className="relative z-10">
            <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-block">
              Presentes Hoy
            </span>
            <p className="text-2xl sm:text-4xl font-black text-slate-900 mt-2 sm:mt-3">
              {metricas?.presentes ?? 0}
            </p>
            <div className="flex items-center gap-1.5 mt-1 sm:mt-2 text-[11px] sm:text-xs font-semibold text-slate-500">
              <span className="text-emerald-600 font-bold">
                {metricas?.porcentajeAsistencia ?? 0}%
              </span>
              <span className="truncate">del alumnado</span>
            </div>
          </div>
        </div>

        {/* 2. Puntualidad */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
          <div className="relative z-10">
            <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-full inline-block">
              Puntuales
            </span>
            <p className="text-2xl sm:text-4xl font-black text-slate-900 mt-2 sm:mt-3">
              {metricas?.puntuales ?? 0}
            </p>
            <div className="flex items-center gap-1.5 mt-1 sm:mt-2 text-[11px] sm:text-xs font-semibold text-slate-500">
              <span className="text-blue-600 font-bold">
                {metricas?.porcentajePuntualidad ?? 0}%
              </span>
              <span className="truncate">a tiempo</span>
            </div>
          </div>
        </div>

        {/* 3. Tardanzas */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-amber-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
          <div className="relative z-10">
            <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full inline-block">
              Tardanzas
            </span>
            <p className="text-2xl sm:text-4xl font-black text-amber-600 mt-2 sm:mt-3">
              {metricas?.tardanzas ?? 0}
            </p>
            <div className="flex items-center gap-1 mt-1 sm:mt-2 text-[11px] sm:text-xs font-semibold text-slate-500">
              <span className="truncate">En tolerancia</span>
            </div>
          </div>
        </div>

        {/* 4. Inasistencias / Ausencias */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-400 hover:shadow-md transition flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-rose-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
          <div className="relative z-10">
            <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-full inline-block">
              Inasistencias
            </span>
            <p className="text-2xl sm:text-4xl font-black text-rose-600 mt-2 sm:mt-3">
              {metricas?.ausentes ?? 0}
            </p>
            <div className="flex items-center gap-1 mt-1 sm:mt-2 text-[11px] sm:text-xs font-semibold text-slate-500">
              <span className="truncate">Sin registro</span>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE DE GRÁFICOS SOLICITADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
        {/* ========================================================= */}
        {/* GRÁFICO 1: ASISTENCIA GENERAL (DONA / CIRCULAR) (5 Cols)   */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-1.5">
                <span>🍩</span> Gráfico 1: Asistencia General
              </h3>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                Consolidado
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Distribución porcentual de alumnas presentes, tardanzas e inasistencias.
            </p>
          </div>

          <div className="h-56 sm:h-64 w-full relative my-3 sm:my-5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    distribucion.reduce((acc, curr) => acc + (curr.valor || 0), 0) > 0
                      ? distribucion
                      : [{ name: "Sin registros hoy", valor: 1, color: "#f1f5f9" }]
                  }
                  dataKey="valor"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={distribucion.reduce((acc, curr) => acc + (curr.valor || 0), 0) > 0 ? 4 : 0}
                >
                  {(distribucion.reduce((acc, curr) => acc + (curr.valor || 0), 0) > 0
                    ? distribucion
                    : [{ name: "Sin registros hoy", valor: 1, color: "#e2e8f0" }]
                  ).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [
                    distribucion.reduce((acc, curr) => acc + (curr.valor || 0), 0) > 0
                      ? `${value} estudiantes`
                      : "0 registros",
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "14px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "bold",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centro de la Dona con Porcentaje Principal */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metricas?.porcentajeAsistencia ?? 0}%
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-slate-400">
                Asistencia Hoy
              </span>
            </div>
          </div>

          {/* Tarjetas de Desglose en Leyenda */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
            {distribucion.map((item) => (
              <div
                key={item.name}
                className="p-2 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center"
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-bold text-[10px] sm:text-[11px] text-slate-700 truncate max-w-[70px] sm:max-w-[80px]">
                    {item.name}
                  </span>
                </div>
                <span className="font-black text-slate-900 text-sm sm:text-base">
                  {item.valor}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================= */}
        {/* GRÁFICO 2: ASISTENCIA POR TURNO (BARRAS ANIMADAS) (7 Cols)*/}
        {/* ========================================================= */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-1.5">
                <span>📊</span> Gráfico 2: Asistencia por Turno
              </h3>
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                🌅 Mañana · 🌞 Tarde · 🌙 Noche
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Nivel de cobertura y cumplimiento horario por cada turno escolar.
            </p>
          </div>

          {/* Gráfico Recharts de Barras */}
          <div className="h-56 sm:h-64 w-full my-3 sm:my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={turnos}
                margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="turno"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#334155", fontSize: 12, fontWeight: "bold" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(241, 245, 249, 0.7)" }}
                  formatter={(value: any, name: any, item: any) => [
                    `${value}% de asistencia (${item.payload.presentes ?? 0} presentes)`,
                    item.payload.turno,
                  ]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "14px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                />
                <Bar
                  dataKey="porcentaje"
                  name="% Asistencia"
                  radius={[8, 8, 0, 0]}
                  fill="#8B0000"
                >
                  {turnos.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={
                        entry.turno.toLowerCase().includes("mañana") || entry.turno.toLowerCase().includes("manana")
                          ? "#D4AF37"
                          : entry.turno.toLowerCase().includes("tarde")
                          ? "#B45309"
                          : "#4338CA"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tarjetas de Turnos con Iconos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-slate-100">
            {turnos.map((t) => (
              <div
                key={t.turno}
                className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 block">
                    {t.icono || "🏫"} Turno {t.turno}
                  </span>
                  <span className="text-lg sm:text-xl font-black text-slate-900">
                    {t.porcentaje}%
                  </span>
                </div>
                <div className="text-right text-[9px] sm:text-[10px] text-slate-400 font-mono">
                  <span>{t.presentes} alumnas</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================= */}
        {/* GRÁFICO 3: EVOLUCIÓN MENSUAL (SEMANAS 1..4) (12 Cols)     */}
        {/* ========================================================= */}
        <div className="lg:col-span-12 bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-1.5">
                  <span>📈</span> Gráfico 3: Evolución Mensual de Asistencia
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 sm:px-2.5 py-0.5 rounded-full">
                  Tendencia Mensual
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Seguimiento comparativo por períodos semanales: Semana 1, Semana 2, Semana 3 y Semana 4.
              </p>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-800" />
                <span className="text-slate-700">Asistencia (%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-700">Puntualidad (%)</span>
              </div>
            </div>
          </div>

          <div className="h-56 sm:h-64 lg:h-72 w-full mt-4 sm:mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={evolucion}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorAsistencia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B0000" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B0000" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPuntualidad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="semana"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#334155", fontSize: 11, fontWeight: "bold" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "14px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="asistencia"
                  name="% Asistencia Total"
                  stroke="#8B0000"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAsistencia)"
                />
                <Area
                  type="monotone"
                  dataKey="puntualidad"
                  name="% Puntualidad"
                  stroke="#D4AF37"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPuntualidad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-slate-500 gap-2">
            <span className="flex items-center gap-1.5 font-medium">
              <span>🛡️</span> Datos auditados en portería escolar Santa Rita de Cassia
            </span>
            <span className="font-bold text-amber-700">
              San Vicente de Cañete · Ciclo Escolar 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
