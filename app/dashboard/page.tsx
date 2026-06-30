"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Asistencia = {
  id: number;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  metodo: string;
  estudiante: {
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
  };
};

type DashboardData = {
  totalEstudiantes: number;
  presentes: number;
  ausentes: number;
  entradas: number;
  salidas: number;
  tardanzas: number;
  sinSalida: number;
  ultimasAsistencias: Asistencia[];
};

export default function Dashboard() {
  const [horaActual, setHoraActual] = useState("");
  const [datos, setDatos] = useState<DashboardData>({
    totalEstudiantes: 0,
    presentes: 0,
    ausentes: 0,
    entradas: 0,
    salidas: 0,
    tardanzas: 0,
    sinSalida: 0,
    ultimasAsistencias: [],
  });

  async function cargarDashboard() {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    setDatos(data);
  }

  useEffect(() => {
    cargarDashboard();

    const intervaloDatos = setInterval(cargarDashboard, 5000);

    const intervaloHora = setInterval(() => {
      setHoraActual(
        new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);

    return () => {
      clearInterval(intervaloDatos);
      clearInterval(intervaloHora);
    };
  }, []);

  function hora(fecha: string | null) {
    if (!fecha) return "-";

    return new Date(fecha).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function tipo(asistencia: Asistencia) {
    if (asistencia.horaSalida) return "SALIDA";
    return "ENTRADA";
  }

  const porcentajePresentes =
    datos.totalEstudiantes > 0
      ? Math.round((datos.presentes / datos.totalEstudiantes) * 100)
      : 0;

  const datosGrafico = [
    { name: "Presentes", value: datos.presentes },
    { name: "Ausentes", value: datos.ausentes },
    { name: "Tardanzas", value: datos.tardanzas },
    { name: "Entradas", value: datos.entradas },
    { name: "Salidas", value: datos.salidas },
    { name: "Sin salida", value: datos.sinSalida },
  ];

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 font-bold">Panel General</p>

            <div className="flex items-center gap-4 mt-2">
              <Image
                src="/img/logo-santa-rita.png"
                alt="Logo Santa Rita"
                width={70}
                height={70}
                className="bg-white rounded-xl p-1"
              />

              <div>
                <h2 className="text-4xl font-extrabold">
                  I.E. Santa Rita de Casia
                </h2>
                <p className="text-slate-300 mt-1">
                  Panel de Asistencia Escolar
                </p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-slate-300">Hora actual</p>
            <h3 className="text-4xl font-extrabold">{horaActual}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
        <div className="bg-white rounded-3xl shadow p-6">
          <p className="text-slate-500">👨‍🎓 Estudiantes</p>
          <h3 className="text-4xl font-extrabold mt-3">
            {datos.totalEstudiantes}
          </h3>
        </div>

        <div className="bg-green-50 rounded-3xl shadow p-6">
          <p className="text-green-700">✅ Presentes</p>
          <h3 className="text-4xl font-extrabold mt-3 text-green-700">
            {datos.presentes}
          </h3>
        </div>

        <div className="bg-red-50 rounded-3xl shadow p-6">
          <p className="text-red-700">❌ Ausentes</p>
          <h3 className="text-4xl font-extrabold mt-3 text-red-700">
            {datos.ausentes}
          </h3>
        </div>

        <div className="bg-orange-50 rounded-3xl shadow p-6">
          <p className="text-orange-700">🟠 Tardanzas</p>
          <h3 className="text-4xl font-extrabold mt-3 text-orange-700">
            {datos.tardanzas}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-blue-50 rounded-3xl shadow p-6">
          <p className="text-blue-700">🚪 Entradas</p>
          <h3 className="text-4xl font-extrabold mt-3 text-blue-700">
            {datos.entradas}
          </h3>
        </div>

        <div className="bg-purple-50 rounded-3xl shadow p-6">
          <p className="text-purple-700">🏠 Salidas</p>
          <h3 className="text-4xl font-extrabold mt-3 text-purple-700">
            {datos.salidas}
          </h3>
        </div>

        <div className="bg-cyan-50 rounded-3xl shadow p-6">
          <p className="text-cyan-700">🔵 Sin salida</p>
          <h3 className="text-4xl font-extrabold mt-3 text-cyan-700">
            {datos.sinSalida}
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow p-6 mt-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">
          ⚠️ Alertas del día
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-red-50 text-red-700 rounded-2xl p-4 font-bold">
            ❌ {datos.ausentes} estudiantes ausentes.
          </div>

          <div className="bg-orange-50 text-orange-700 rounded-2xl p-4 font-bold">
            🟠 {datos.tardanzas} tardanzas registradas.
          </div>

          <div className="bg-cyan-50 text-cyan-700 rounded-2xl p-4 font-bold">
            🔵 {datos.sinSalida} estudiantes sin salida.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow p-6 mt-8">
        <h3 className="text-2xl font-bold text-slate-900 mb-5">
          Gráfico de asistencia del día
        </h3>

        <div style={{ width: "100%", height: 320 }}>
  <ResponsiveContainer>
    <BarChart data={datosGrafico}>
      <XAxis dataKey="name" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
</div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-8">
        <div className="bg-white rounded-3xl shadow p-6">
          <h3 className="text-2xl font-bold text-slate-900">
            Asistencia de hoy
          </h3>

          <div className="mt-6">
            <div className="flex justify-between mb-2">
              <span className="font-bold">Presentes</span>
              <span className="font-bold">{porcentajePresentes}%</span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-5">
              <div
                className="bg-green-600 h-5 rounded-full transition-all"
                style={{ width: `${porcentajePresentes}%` }}
              />
            </div>
          </div>

          <p className="text-slate-500 mt-5">
            {datos.presentes} de {datos.totalEstudiantes} estudiantes marcaron
            asistencia hoy.
          </p>

          <p className="text-orange-600 font-bold mt-4">
            🟠 Tardanzas registradas: {datos.tardanzas}
          </p>
        </div>

        <div className="md:col-span-2 bg-white rounded-3xl shadow p-6">
          <h3 className="text-2xl font-bold text-slate-900 mb-5">
            Últimas asistencias
          </h3>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-3">Hora</th>
                <th>Estudiante</th>
                <th>Grado</th>
                <th>Tipo</th>
                <th>Método</th>
              </tr>
            </thead>

            <tbody>
              {datos.ultimasAsistencias.map((asistencia) => (
                <tr key={asistencia.id} className="border-b">
                  <td className="py-3">
                    {hora(asistencia.horaSalida || asistencia.horaEntrada)}
                  </td>
                  <td>
                    {asistencia.estudiante.nombres}{" "}
                    {asistencia.estudiante.apellidos}
                  </td>
                  <td>
                    {asistencia.estudiante.grado} -{" "}
                    {asistencia.estudiante.seccion}
                  </td>
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        tipo(asistencia) === "ENTRADA"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {tipo(asistencia)}
                    </span>
                  </td>
                  <td>{asistencia.metodo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}