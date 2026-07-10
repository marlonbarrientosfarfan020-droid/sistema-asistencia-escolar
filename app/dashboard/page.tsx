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

type TurnoResumen = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  total: number;
  presentes: number;
  ausentes: number;
  puntuales: number;
  tardanzas: number;
  sinSalida: number;
  noLectivo?: boolean;
motivoNoLectivo?: string;
};

type Asistencia = {
  id: number;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  metodo: string;
  estado: string;
  estudiante: {
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    turno?: {
      nombre: string;
    } | null;
  };
};

type DashboardData = {
  totalEstudiantes: number;
  presentes: number;
  ausentes: number;
  entradas: number;
  salidas: number;
  puntuales: number;
  tardanzas: number;
  sinSalida: number;
  horaReporteDiario?: string;
  ultimoReporteTelegramAt?: string | null;
  ultimoReporteTelegramEstado?: string;
  resumenTurnos: TurnoResumen[];
  ultimasAsistencias: Asistencia[];
  riesgoAlto?: number;
riesgoMedio?: number;
riesgoBajo?: number;
resumenIA?: string;
topRiesgoIA: any[];
totalEsperadosHoy?: number;
diaNoLectivo?: boolean;
diaNoLectivoGeneral?: boolean;

eventosNoLectivosHoy?: {
  id: number;
  tipo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  todosLosTurnos: boolean;
  turnoId: number | null;
  turno: string | null;
}[];
};

export default function Dashboard() {
  const [horaActual, setHoraActual] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [datos, setDatos] = useState<DashboardData>({
    totalEstudiantes: 0,
    presentes: 0,
    ausentes: 0,
    entradas: 0,
    salidas: 0,
    puntuales: 0,
    tardanzas: 0,
    sinSalida: 0,
    horaReporteDiario: "21:00",
    ultimoReporteTelegramAt: null,
    ultimoReporteTelegramEstado: "",
    resumenTurnos: [],
    ultimasAsistencias: [],
    topRiesgoIA: [],
    totalEsperadosHoy: 0,
diaNoLectivo: false,
diaNoLectivoGeneral: false,
eventosNoLectivosHoy: [],
  });

  async function cargarDashboard() {
  try {
    const res = await fetch("/api/dashboard", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));

      setMensaje(
        `❌ ${data.message || "No se pudo cargar el dashboard"}`
      );

      return;
    }

    const data = await res.json();

    setDatos({
      totalEstudiantes: data.totalEstudiantes || 0,
      presentes: data.presentes || 0,
      ausentes: data.ausentes || 0,
      entradas: data.entradas || 0,
      salidas: data.salidas || 0,
      puntuales: data.puntuales || 0,
      tardanzas: data.tardanzas || 0,
      sinSalida: data.sinSalida || 0,
      horaReporteDiario: data.horaReporteDiario || "21:00",
      ultimoReporteTelegramAt:
        data.ultimoReporteTelegramAt || null,
      ultimoReporteTelegramEstado:
        data.ultimoReporteTelegramEstado || "",
      resumenTurnos: Array.isArray(data.resumenTurnos)
        ? data.resumenTurnos
        : [],
      ultimasAsistencias: Array.isArray(data.ultimasAsistencias)
        ? data.ultimasAsistencias
        : [],
      riesgoAlto: data.riesgoAlto || 0,
      riesgoMedio: data.riesgoMedio || 0,
      riesgoBajo: data.riesgoBajo || 0,
      resumenIA:
        data.resumenIA ||
        "La IA aún no ha generado un resumen ejecutivo.",
      topRiesgoIA: Array.isArray(data.topRiesgoIA)
        ? data.topRiesgoIA
        : [],
        totalEsperadosHoy: data.totalEsperadosHoy || 0,
diaNoLectivo: Boolean(data.diaNoLectivo),
diaNoLectivoGeneral: Boolean(data.diaNoLectivoGeneral),

eventosNoLectivosHoy: Array.isArray(
  data.eventosNoLectivosHoy
)
  ? data.eventosNoLectivosHoy
  : [],
    });

    setMensaje("");
  } catch (error) {
    console.error("Error cargando dashboard:", error);

    setMensaje(
      "⚠️ No se pudo conectar temporalmente con el servidor."
    );
  }
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

  function fechaHora(fecha: string | null | undefined) {
    if (!fecha) return "Sin registro";

    return new Date(fecha).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function tipo(asistencia: Asistencia) {
    return asistencia.horaSalida ? "SALIDA" : "ENTRADA";
  }

  const porcentajePresentes =
    datos.totalEstudiantes > 0
      ? Math.round((datos.presentes / datos.totalEstudiantes) * 100)
      : 0;

  const datosGrafico = [
    { name: "Puntuales", value: datos.puntuales },
    { name: "Tardanzas", value: datos.tardanzas },
    { name: "Ausentes", value: datos.ausentes },
    { name: "Sin salida", value: datos.sinSalida },
  ];

  return (
    <>
      {mensaje && (
        <div className="bg-red-50 text-red-700 rounded-2xl p-4 mb-6 font-bold">
          {mensaje}
        </div>
        
      )}

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
                  Panel profesional de asistencia escolar
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
      {datos.diaNoLectivo && (
  <div className="mt-8 bg-red-50 border-2 border-red-300 rounded-3xl p-6 shadow">
    <div className="flex items-start gap-4">
      <div className="text-5xl">📅</div>

      <div className="flex-1">
        <h2 className="text-3xl font-extrabold text-red-700">
          Hoy es día no lectivo
        </h2>

        <p className="text-red-600 mt-2 font-bold">
          La marcación y las alertas automáticas de ausencia
          están suspendidas para los turnos correspondientes.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-5">
          {datos.eventosNoLectivosHoy?.map((evento) => (
            <div
              key={evento.id}
              className="bg-white border border-red-200 rounded-2xl p-4"
            >
              <p className="font-extrabold text-red-700">
                {evento.tipo.replaceAll("_", " ")}
              </p>

              <p className="text-slate-800 mt-1">
                {evento.descripcion}
              </p>

              <p className="text-sm text-slate-500 mt-2">
                Aplicación:{" "}
                {evento.todosLosTurnos
                  ? "Todos los turnos"
                  : evento.turno || "Turno específico"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-700 rounded-3xl p-8 mt-8 text-white shadow-xl">

  <div className="flex items-center justify-between">

    <div>
      <h2 className="text-3xl font-extrabold">
        🧠 Centro de Inteligencia Escolar
      </h2>
      

      <p className="text-indigo-100 mt-2">
        Monitoreo inteligente basado en IA
      </p>
    </div>

    <button
      onClick={() => window.location.href="/dashboard/inteligencia"}
      className="bg-white text-indigo-700 px-6 py-3 rounded-2xl font-bold hover:bg-indigo-50"
    >
      Ver análisis IA
    </button>

  </div>

  <div className="grid md:grid-cols-3 gap-5 mt-8">

    <div className="bg-red-500/20 rounded-2xl p-5">
      <p className="text-red-100">🔴 Riesgo Alto</p>
      <h3 className="text-5xl font-extrabold mt-2">
        {datos.riesgoAlto}
      </h3>
    </div>

    <div className="bg-orange-500/20 rounded-2xl p-5">
      <p className="text-orange-100">🟠 Riesgo Medio</p>
      <h3 className="text-5xl font-extrabold mt-2">
        {datos.riesgoMedio}
      </h3>
    </div>

    <div className="bg-green-500/20 rounded-2xl p-5">
      <p className="text-green-100">🟢 Riesgo Bajo</p>
      <h3 className="text-5xl font-extrabold mt-2">
        {datos.riesgoBajo}
      </h3>
    </div>

  </div>

  <div className="bg-white/10 rounded-2xl p-6 mt-8">

    <h3 className="text-xl font-bold mb-3">
      📈 Resumen Inteligente
    </h3>

    <p className="leading-8">
      {datos.resumenIA}
    </p>

  </div>

</div>
<div className="bg-white rounded-3xl shadow p-6 mt-8">
  <div className="flex items-center justify-between mb-5">
    <h3 className="text-2xl font-bold">🔥 Top Riesgo IA</h3>

    <button
      onClick={() => (window.location.href = "/dashboard/inteligencia/ranking")}
      className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold"
    >
      Ver ranking completo
    </button>
  </div>

  <div className="grid md:grid-cols-5 gap-4">
    {datos.topRiesgoIA?.map((item: any, index: number) => (
      <div key={item.id} className="border rounded-2xl p-4 bg-slate-50">
        <p className="text-3xl font-extrabold text-slate-300">
          #{index + 1}
        </p>

        <h4 className="font-bold mt-2">
          {item.estudiante.nombres} {item.estudiante.apellidos}
        </h4>

        <p className="text-sm text-slate-500">
          {item.estudiante.grado} - {item.estudiante.seccion}
        </p>

        <p className="mt-3 text-3xl font-extrabold">
          {item.porcentaje}%
        </p>

        <span
          className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold ${
            item.nivel === "ALTO"
              ? "bg-red-100 text-red-700"
              : item.nivel === "MEDIO"
              ? "bg-orange-100 text-orange-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {item.nivel}
        </span>
      </div>
    ))}

    {datos.topRiesgoIA?.length === 0 && (
      <div className="col-span-5 text-center text-slate-500 py-8">
        Aún no hay estudiantes con riesgo IA analizado.
      </div>
    )}
  </div>
</div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
        <CardDashboard titulo="👨‍🎓 Estudiantes" valor={datos.totalEstudiantes} />
        <CardDashboard titulo="✅ Presentes" valor={datos.presentes} color="green" />
        <CardDashboard titulo="🟢 Puntuales" valor={datos.puntuales} color="emerald" />
        <CardDashboard titulo="🟠 Tardanzas" valor={datos.tardanzas} color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <CardDashboard titulo="❌ Ausentes" valor={datos.ausentes} color="red" />
        <CardDashboard titulo="🚪 Entradas" valor={datos.entradas} color="blue" />
        <CardDashboard titulo="🏠 Salidas" valor={datos.salidas} color="purple" />
        <CardDashboard titulo="🔵 Sin salida" valor={datos.sinSalida} color="cyan" />
      </div>
      

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-3xl shadow p-6">
          <h3 className="text-2xl font-bold mb-4">📊 Reporte automático</h3>

          <p className="font-bold text-slate-700">
            🕘 Próximo horario:{" "}
            <span className="text-blue-700">
              {datos.horaReporteDiario || "21:00"}
            </span>
          </p>

          <p className="font-bold text-slate-700 mt-3">
            📤 Último envío:{" "}
            <span className="text-slate-600">
              {fechaHora(datos.ultimoReporteTelegramAt)}
            </span>
          </p>

          <p className="font-bold text-slate-700 mt-3">
            Estado:{" "}
            <span className="text-green-700">
              {datos.ultimoReporteTelegramEstado || "Aún no enviado"}
            </span>
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow p-6">
          <h3 className="text-2xl font-bold mb-4">⚠️ Alertas del día</h3>

          <div className="grid gap-3">
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
      </div>

      <div className="bg-white rounded-3xl shadow p-6 mt-8">
        <h3 className="text-2xl font-bold mb-5">
          📈 Gráfico de asistencia del día
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
      

      <div className="bg-white rounded-3xl shadow p-6 mt-8">
        <h3 className="text-2xl font-bold mb-5">⏰ Resumen por turnos</h3>

        <div className="grid md:grid-cols-3 gap-6">
          {datos.resumenTurnos.map((turno) => (
            <div key={turno.id} className="rounded-3xl border bg-slate-50 p-6">
              <h4 className="text-2xl font-extrabold">⏰ {turno.nombre}</h4>

              <p className="text-slate-500 mt-1">
                {turno.horaEntrada} - {turno.horaSalida}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-5 text-sm font-bold">
                <div className="bg-white rounded-xl p-3">Total: {turno.total}</div>
                <div className="bg-green-50 text-green-700 rounded-xl p-3">
                  Presentes: {turno.presentes}
                </div>
                <div className="bg-red-50 text-red-700 rounded-xl p-3">
                  Ausentes: {turno.ausentes}
                </div>
                <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3">
                  Puntuales: {turno.puntuales}
                </div>
                <div className="bg-orange-50 text-orange-700 rounded-xl p-3">
                  Tardanzas: {turno.tardanzas}
                </div>
                <div className="bg-cyan-50 text-cyan-700 rounded-xl p-3">
                  Sin salida: {turno.sinSalida}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-8">
        <div className="bg-white rounded-3xl shadow p-6">
          <h3 className="text-2xl font-bold">📌 Asistencia de hoy</h3>

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
        </div>

        <div className="md:col-span-2 bg-white rounded-3xl shadow p-6">
          <h3 className="text-2xl font-bold mb-5">🕒 Últimas asistencias</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b">
                  <th className="py-3">Hora</th>
                  <th>Estudiante</th>
                  <th>Turno</th>
                  <th>Estado</th>
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

                    <td>{asistencia.estudiante.turno?.nombre || "Sin turno"}</td>

                    <td>{asistencia.estado}</td>

                    <td>{tipo(asistencia)}</td>

                    <td>{asistencia.metodo}</td>
                  </tr>
                ))}

                {datos.ultimasAsistencias.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Aún no hay asistencias registradas hoy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function CardDashboard({
  titulo,
  valor,
  color = "slate",
}: {
  titulo: string;
  valor: number;
  color?: "slate" | "green" | "emerald" | "orange" | "red" | "blue" | "purple" | "cyan";
}) {
  const colores: any = {
    slate: "bg-white text-slate-900",
    green: "bg-green-50 text-green-700",
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };

  return (
    <div className={`${colores[color]} rounded-3xl shadow p-6`}>
      <p className="font-bold">{titulo}</p>
      <h3 className="text-4xl font-extrabold mt-3">{valor}</h3>
    </div>
  );
}