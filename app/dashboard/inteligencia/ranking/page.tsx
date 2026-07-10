"use client";

import { useEffect, useState } from "react";

type RankingItem = {
  id: number;
  nivel: string;
  porcentaje: number;
  resumen: string;
  recomendacion: string;
  updatedAt: string;
  estudiante: {
    dni: string;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    turno?: {
      nombre: string;
    } | null;
  };
};

export default function RankingRiesgoPage() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargarRanking() {
    const res = await fetch("/api/ia/ranking-riesgo");
    const data = await res.json();

    if (data.ok) {
      setRanking(data.ranking);
    }

    setCargando(false);
  }

  useEffect(() => {
    cargarRanking();
  }, []);

  function colorNivel(nivel: string) {
    const n = nivel.toUpperCase();

    if (n === "ALTO") return "bg-red-100 text-red-700";
    if (n === "MEDIO") return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-red-700 to-slate-900 text-white rounded-3xl p-8 shadow">
        <h1 className="text-4xl font-extrabold mb-2">
          🔥 Ranking Inteligente de Riesgo
        </h1>
        <p className="text-red-100">
          Lista de estudiantes priorizados según el análisis de riesgo generado por IA.
        </p>
      </div>

      {cargando && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 font-bold text-blue-700">
          Cargando ranking inteligente...
        </div>
      )}

      {!cargando && ranking.length === 0 && (
        <div className="bg-white rounded-2xl shadow p-6 text-slate-600">
          Aún no hay estudiantes con riesgo IA analizado.
        </div>
      )}

      <div className="grid gap-5">
        {ranking.map((item, index) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl shadow p-6 border flex flex-col md:flex-row md:items-center md:justify-between gap-5"
          >
            <div className="flex items-center gap-5">
              <div className="text-5xl font-extrabold text-slate-300">
                #{index + 1}
              </div>

              <div>
                <h2 className="text-2xl font-bold">
                  {item.estudiante.nombres} {item.estudiante.apellidos}
                </h2>

                <p className="text-slate-500">
                  DNI: {item.estudiante.dni} | {item.estudiante.grado} -{" "}
                  {item.estudiante.seccion} |{" "}
                  {item.estudiante.turno?.nombre || "Sin turno"}
                </p>

                <p className="mt-3 text-slate-700">
                  <b>Resumen IA:</b> {item.resumen}
                </p>

                <p className="mt-2 text-slate-700">
                  <b>Recomendación:</b> {item.recomendacion}
                </p>
              </div>
            </div>

            <div className="text-center min-w-[160px]">
              <div
                className={`rounded-2xl px-5 py-3 font-bold ${colorNivel(
                  item.nivel
                )}`}
              >
                {item.nivel}
              </div>

              <div className="text-5xl font-extrabold mt-3">
                {item.porcentaje}%
              </div>

              <p className="text-slate-500 text-sm mt-1">Riesgo IA</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}