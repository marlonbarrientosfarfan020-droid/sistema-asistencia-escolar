"use client";

import { useState } from "react";

export default function InteligenciaPage() {
  const [dni, setDni] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState("");

  async function analizar(tipo: "general" | "individual") {
    setCargando(true);
    setError("");
    setResultado(null);

    try {
      const url =
        tipo === "individual" && dni.trim()
          ? `/api/ia/anomalias?dni=${dni.trim()}`
          : "/api/ia/anomalias";

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Error al generar análisis");
        return;
      }

      setResultado(data);
    } catch {
      setError("No se pudo conectar con la IA");
    } finally {
      setCargando(false);
    }
  }

  function formatearAnalisis(texto: string) {
    if (!texto) return "";

    return texto
      .replaceAll("**", "")
      .replaceAll("\\n", "\n")
      .replaceAll("###", "")
      .trim();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-700 to-slate-900 text-white rounded-3xl p-8 shadow">
        <h1 className="text-4xl font-extrabold mb-2">
          🧠 Centro de Inteligencia Escolar
        </h1>
        <p className="text-blue-100">
          Módulo de IA para analizar asistencia, tardanzas, ausencias y patrones
          de riesgo escolar.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-slate-500">Motor IA</p>
          <h3 className="text-2xl font-bold">Groq</h3>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-slate-500">Análisis</p>
          <h3 className="text-2xl font-bold">30 días</h3>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-slate-500">Modo</p>
          <h3 className="text-2xl font-bold">
            {resultado?.modo === "individual" ? "Individual" : "General"}
          </h3>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-slate-500">Analizados</p>
          <h3 className="text-2xl font-bold">
            {resultado?.estudiantesAnalizados || 0}
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow p-6">
        <h2 className="text-2xl font-bold mb-2">Generar análisis inteligente</h2>
        <p className="text-slate-500 mb-5">
          Puedes analizar a todos los estudiantes o buscar un estudiante por DNI.
        </p>

        <div className="flex flex-col md:flex-row gap-4">
          <button
            onClick={() => analizar("general")}
            disabled={cargando}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {cargando ? "Analizando..." : "🧠 Analizar todos"}
          </button>

          <input
            value={dni}
            onChange={(e) =>
              setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="Ingrese DNI"
            className="border rounded-xl px-4 py-3 w-full md:w-72"
          />

          <button
            onClick={() => analizar("individual")}
            disabled={cargando || !dni.trim()}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50"
          >
            🔎 Analizar por DNI
          </button>
        </div>
      </div>

      {cargando && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-blue-700 font-bold">
          ⏳ La inteligencia artificial está analizando la información...
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 rounded-2xl p-5 font-bold">
          ❌ {error}
        </div>
      )}

      {resultado && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow p-6">
            <h2 className="text-2xl font-bold mb-4">
              📋 Informe generado por IA
            </h2>

            <div className="bg-slate-50 border rounded-2xl p-6 whitespace-pre-wrap leading-8 text-slate-800 text-base">
              {formatearAnalisis(resultado.analisis)}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow p-6">
              <h3 className="text-xl font-bold mb-4">📌 Datos analizados</h3>

              <p>
                <b>Modo:</b>{" "}
                {resultado.modo === "individual" ? "Individual" : "General"}
              </p>
              <p>
                <b>Estudiantes:</b> {resultado.estudiantesAnalizados}
              </p>
              <p>
                <b>Periodo:</b> Últimos 30 días
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow p-6">
              <h3 className="text-xl font-bold mb-4">👥 Estudiantes incluidos</h3>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {resultado.datos?.map((e: any) => (
                  <div
                    key={e.dni}
                    className="border rounded-xl p-3 bg-slate-50"
                  >
                    <p className="font-bold">{e.estudiante}</p>
                    <p className="text-sm text-slate-600">DNI: {e.dni}</p>
                    <p className="text-sm text-slate-600">
                      {e.grado} - {e.seccion} | {e.turno}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <span className="bg-green-100 text-green-700 rounded-lg p-2">
                        Puntuales: {e.puntuales}
                      </span>
                      <span className="bg-orange-100 text-orange-700 rounded-lg p-2">
                        Tardanzas: {e.tardanzas}
                      </span>
                      <span className="bg-red-100 text-red-700 rounded-lg p-2">
                        Registros: {e.totalRegistros}
                      </span>
                      <span className="bg-blue-100 text-blue-700 rounded-lg p-2">
                        Sin salida: {e.sinSalida}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}