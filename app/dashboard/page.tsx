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
  CartesianGrid,
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

type RiesgoIA = {
  id: number;
  nivel: string;
  porcentaje: number;
  estudiante: {
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
  };
};

type EventoNoLectivo = {
  id: number;
  tipo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  todosLosTurnos: boolean;
  turnoId: number | null;
  turno: string | null;
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
  topRiesgoIA: RiesgoIA[];

  totalEsperadosHoy?: number;
  diaNoLectivo?: boolean;
  diaNoLectivoGeneral?: boolean;
  eventosNoLectivosHoy?: EventoNoLectivo[];
};

type ColorTarjeta =
  | "slate"
  | "green"
  | "emerald"
  | "orange"
  | "red"
  | "blue"
  | "purple"
  | "cyan";

const cardClass =
  "rounded-3xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]";

import ProteccionRol from "@/components/auth/ProteccionRol";

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

    riesgoAlto: 0,
    riesgoMedio: 0,
    riesgoBajo: 0,
    resumenIA: "La IA aún no ha generado un resumen ejecutivo.",
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

    const actualizarHora = () => {
      setHoraActual(
        new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "America/Lima",
        })
      );
    };

    actualizarHora();

    const intervaloHora = setInterval(actualizarHora, 1000);

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
      timeZone: "America/Lima",
    });
  }

  function fechaHora(fecha: string | null | undefined) {
    if (!fecha) return "Sin registro";

    return new Date(fecha).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    });
  }

  function tipo(asistencia: Asistencia) {
    return asistencia.horaSalida ? "SALIDA" : "ENTRADA";
  }

  const porcentajePresentes =
    datos.totalEstudiantes > 0
      ? Math.round(
          (datos.presentes / datos.totalEstudiantes) * 100
        )
      : 0;

  const datosGrafico = [
    { name: "Puntuales", value: datos.puntuales },
    { name: "Tardanzas", value: datos.tardanzas },
    { name: "Ausentes", value: datos.ausentes },
    { name: "Sin salida", value: datos.sinSalida },
  ];

  return (
  <ProteccionRol
    rolesPermitidos={[
      "ADMIN",
      "DIRECTIVO",
      "DEMO",
    ]}
  >
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/60 to-indigo-50 px-4 py-6 md:px-7 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-7">
        {mensaje && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700 shadow-sm">
            {mensaje}
          </div>
        )}

        {/* CABECERA */}
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] md:p-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-200">
                Panel general
              </p>

              <div className="mt-4 flex items-center gap-4">
                <div className="rounded-2xl bg-white p-2 shadow-xl">
                  
                    
                
                </div>

                <div>
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                    Santa Rita de Cassia
                  </h1>

                  <p className="mt-2 text-sm font-medium text-slate-300 md:text-base">
                    Sistema inteligente de control de asistencia escolar
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-4 text-left backdrop-blur-xl lg:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-300">
                Hora actual
              </p>

              <h2 className="mt-2 text-3xl font-black tabular-nums md:text-4xl">
                {horaActual}
              </h2>

              <p className="mt-1 text-sm text-blue-200">
                Hora local de Perú
              </p>
            </div>
          </div>
        </section>

        {/* DÍA NO LECTIVO */}
        {datos.diaNoLectivo && (
          <section className="rounded-3xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-6 shadow-[0_12px_35px_rgba(239,68,68,0.10)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-3xl text-white shadow-lg shadow-red-200">
                📅
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-black text-red-700 md:text-3xl">
                  Hoy es día no lectivo
                </h2>

                <p className="mt-2 font-semibold text-red-600">
                  La marcación y las alertas automáticas de ausencia
                  están suspendidas para los turnos correspondientes.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {datos.eventosNoLectivosHoy?.map((evento) => (
                    <div
                      key={evento.id}
                      className="rounded-2xl border border-red-200 bg-white/90 p-4 shadow-sm"
                    >
                      <p className="font-black text-red-700">
                        {evento.tipo.replaceAll("_", " ")}
                      </p>

                      <p className="mt-1 text-slate-800">
                        {evento.descripcion}
                      </p>

                      <p className="mt-3 text-sm font-semibold text-slate-500">
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
          </section>
        )}

        {/* CENTRO IA */}
       <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-indigo-800 via-violet-700 to-fuchsia-700 p-4 text-white shadow-[0_16px_40px_rgba(109,40,217,0.20)] sm:p-5 md:p-7">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
               <h2 className="text-xl font-black sm:text-2xl md:text-3xl">
                  🧠 Centro de Inteligencia Escolar
                </h2>

               <p className="mt-1 hidden text-sm text-indigo-100 sm:block">
                  Monitoreo preventivo y análisis inteligente de asistencia
                </p>
              </div>

              <button
                onClick={() =>
                  (window.location.href =
                    "/dashboard/inteligencia")
                }
             className="rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-lg sm:px-5 sm:py-3 sm:text-base"
              >
                Ver análisis IA
              </button>
            </div>
</div>
           <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
              <RiskCard
                titulo="Riesgo alto"
                valor={datos.riesgoAlto || 0}
                icono="🔴"
                clase="border-red-300/20 bg-red-500/20"
              />

              <RiskCard
                titulo="Riesgo medio"
                valor={datos.riesgoMedio || 0}
                icono="🟠"
                clase="border-orange-300/20 bg-orange-500/20"
              />

              <RiskCard
                titulo="Riesgo bajo"
                valor={datos.riesgoBajo || 0}
                icono="🟢"
                clase="border-green-300/20 bg-green-500/20"
              />
            </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl">
  <summary className="cursor-pointer list-none px-4 py-3 font-black">
    📈 Ver resumen inteligente
  </summary>

  <div className="border-t border-white/10 px-4 py-4">
    <p className="whitespace-pre-line text-sm leading-6 text-indigo-50">
      {datos.resumenIA}
    </p>
  </div>
</details>
        </section>

        {/* RANKING IA */}
        <section className={`${cardClass} p-6 md:p-7`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900">
                🔥 Top Riesgo IA
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Estudiantes con mayor nivel preventivo detectado
              </p>
            </div>

            <button
              onClick={() =>
                (window.location.href =
                  "/dashboard/inteligencia/ranking")
              }
              className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white shadow-lg shadow-red-200 transition hover:-translate-y-0.5 hover:bg-red-700"
            >
              Ver ranking completo
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {datos.topRiesgoIA.map((item, index) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-100/70" />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-slate-300">
                      #{index + 1}
                    </span>

                    <span className="text-2xl">
                      {index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : "🎯"}
                    </span>
                  </div>

                  <h4 className="mt-4 min-h-[48px] font-black text-slate-900">
                    {item.estudiante.nombres}{" "}
                    {item.estudiante.apellidos}
                  </h4>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.estudiante.grado} -{" "}
                    {item.estudiante.seccion}
                  </p>

                  <p className="mt-4 text-4xl font-black text-slate-900">
                    {item.porcentaje}%
                  </p>

                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${
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
              </div>
            ))}

            {datos.topRiesgoIA.length === 0 && (
              <div className="col-span-full rounded-3xl bg-slate-50 py-10 text-center font-semibold text-slate-500">
                Aún no hay estudiantes con riesgo IA analizado.
              </div>
            )}
          </div>
        </section>

        {/* INDICADORES */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <CardDashboard
            titulo="👨‍🎓 Estudiantes"
            valor={datos.totalEstudiantes}
          />

          <CardDashboard
            titulo="✅ Presentes"
            valor={datos.presentes}
            color="green"
          />

          <CardDashboard
            titulo="🟢 Puntuales"
            valor={datos.puntuales}
            color="emerald"
          />

          <CardDashboard
            titulo="🟠 Tardanzas"
            valor={datos.tardanzas}
            color="orange"
          />

          <CardDashboard
            titulo="❌ Ausentes"
            valor={datos.ausentes}
            color="red"
          />

          <CardDashboard
            titulo="🚪 Entradas"
            valor={datos.entradas}
            color="blue"
          />

          <CardDashboard
            titulo="🏠 Salidas"
            valor={datos.salidas}
            color="purple"
          />

          <CardDashboard
            titulo="🔵 Sin salida"
            valor={datos.sinSalida}
            color="cyan"
          />
        </section>

        {/* REPORTES Y ALERTAS */}
        <section className="grid gap-6 xl:grid-cols-2">
          <div className={`${cardClass} p-6 md:p-7`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  Reporte automático
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Estado y programación del último envío
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
                📤
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <InfoBox
                titulo="Próximo horario"
                valor={datos.horaReporteDiario || "21:00"}
                clase="bg-blue-50 text-blue-700"
              />

              <InfoBox
                titulo="Último envío"
                valor={fechaHora(datos.ultimoReporteTelegramAt)}
                clase="bg-slate-50 text-slate-700"
              />

              <InfoBox
                titulo="Estado"
                valor={
                  datos.ultimoReporteTelegramEstado ||
                  "Aún no enviado"
                }
                clase="bg-emerald-50 text-emerald-700"
              />
            </div>
          </div>

          <div className={`${cardClass} p-6 md:p-7`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  Alertas del día
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Incidencias detectadas durante la jornada
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                ⚠️
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <AlertBox
                texto={`${datos.ausentes} estudiantes ausentes`}
                icono="❌"
                clase="border-red-100 bg-red-50 text-red-700"
              />

              <AlertBox
                texto={`${datos.tardanzas} tardanzas registradas`}
                icono="🟠"
                clase="border-orange-100 bg-orange-50 text-orange-700"
              />

              <AlertBox
                texto={`${datos.sinSalida} estudiantes sin salida`}
                icono="🔵"
                clase="border-cyan-100 bg-cyan-50 text-cyan-700"
              />
            </div>
          </div>
        </section>

        {/* GRÁFICO */}
        <section className={`${cardClass} p-6 md:p-7`}>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              📈 Gráfico de asistencia del día
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Comparación de puntualidad, tardanzas y ausencias
            </p>
          </div>

          <div className="mt-6 h-[340px] w-full rounded-3xl bg-gradient-to-br from-slate-50 to-blue-50/40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datosGrafico}
                margin={{
                  top: 20,
                  right: 20,
                  left: -10,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#cbd5e1"
                />

                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "#475569",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "#64748b",
                    fontWeight: 600,
                  }}
                />

                <Tooltip
                  cursor={{ fill: "rgba(79,70,229,0.06)" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    boxShadow:
                      "0 15px 35px rgba(15,23,42,0.12)",
                  }}
                />

                <Bar
                  dataKey="value"
                  fill="#4f46e5"
                  radius={[14, 14, 4, 4]}
                  barSize={72}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* TURNOS */}
        <section className={`${cardClass} p-6 md:p-7`}>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              ⏰ Resumen por turnos
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Indicadores de asistencia separados por horario
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {datos.resumenTurnos.map((turno) => (
              <div
                key={turno.id}
                className={`rounded-3xl border p-6 shadow-sm ${
                  turno.noLectivo
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-2xl font-black text-slate-900">
                      ⏰ {turno.nombre}
                    </h4>

                    <p className="mt-1 font-semibold text-slate-500">
                      {turno.horaEntrada} - {turno.horaSalida}
                    </p>
                  </div>

                  {turno.noLectivo && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                      NO LECTIVO
                    </span>
                  )}
                </div>

                {turno.noLectivo && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-white p-3 text-sm font-semibold text-red-700">
                    {turno.motivoNoLectivo ||
                      "Turno suspendido por calendario escolar"}
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <TurnoDato
                    titulo="Total"
                    valor={turno.total}
                    clase="bg-white text-slate-700"
                  />

                  <TurnoDato
                    titulo="Presentes"
                    valor={turno.presentes}
                    clase="bg-green-50 text-green-700"
                  />

                  <TurnoDato
                    titulo="Ausentes"
                    valor={turno.ausentes}
                    clase="bg-red-50 text-red-700"
                  />

                  <TurnoDato
                    titulo="Puntuales"
                    valor={turno.puntuales}
                    clase="bg-emerald-50 text-emerald-700"
                  />

                  <TurnoDato
                    titulo="Tardanzas"
                    valor={turno.tardanzas}
                    clase="bg-orange-50 text-orange-700"
                  />

                  <TurnoDato
                    titulo="Sin salida"
                    valor={turno.sinSalida}
                    clase="bg-cyan-50 text-cyan-700"
                  />
                </div>
              </div>
            ))}

            {datos.resumenTurnos.length === 0 && (
              <div className="col-span-full rounded-3xl bg-slate-50 py-10 text-center font-semibold text-slate-500">
                No hay turnos disponibles.
              </div>
            )}
          </div>
        </section>

        {/* ASISTENCIA Y TABLA */}
        <section className="grid gap-6 xl:grid-cols-3">
          <div className={`${cardClass} p-6 md:p-7`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  Asistencia de hoy
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Porcentaje general de estudiantes presentes
                </p>
              </div>

              <div className="rounded-2xl bg-green-100 p-3 text-2xl">
                📌
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 p-3 shadow-xl shadow-green-200">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-4xl font-black text-slate-900">
                    {porcentajePresentes}%
                  </span>

                  <span className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    presentes
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-700"
                style={{
                  width: `${porcentajePresentes}%`,
                }}
              />
            </div>

            <p className="mt-5 text-center font-semibold text-slate-500">
              {datos.presentes} de {datos.totalEstudiantes} estudiantes
              marcaron asistencia hoy.
            </p>
          </div>

          <div className={`${cardClass} p-6 md:col-span-2 md:p-7`}>
            <div>
              <h3 className="text-2xl font-black text-slate-900">
                🕒 Últimas asistencias
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Registros recientes de entrada y salida
              </p>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-4 text-sm">Hora</th>
                    <th className="px-4 py-4 text-sm">Estudiante</th>
                    <th className="px-4 py-4 text-sm">Turno</th>
                    <th className="px-4 py-4 text-sm">Estado</th>
                    <th className="px-4 py-4 text-sm">Tipo</th>
                    <th className="px-4 py-4 text-sm">Método</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {datos.ultimasAsistencias.map(
                    (asistencia, index) => (
                      <tr
                        key={asistencia.id}
                        className={`transition hover:bg-blue-50 ${
                          index % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50/70"
                        }`}
                      >
                        <td className="px-4 py-4 font-bold text-slate-700">
                          {hora(
                            asistencia.horaSalida ||
                              asistencia.horaEntrada
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black text-slate-900">
                            {asistencia.estudiante.nombres}{" "}
                            {asistencia.estudiante.apellidos}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {asistencia.estudiante.grado} -{" "}
                            {asistencia.estudiante.seccion}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-600">
                          {asistencia.estudiante.turno?.nombre ||
                            "Sin turno"}
                        </td>

                        <td className="px-4 py-4">
                          <EstadoBadge estado={asistencia.estado} />
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                            {tipo(asistencia)}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-600">
                          {asistencia.metodo}
                        </td>
                      </tr>
                    )
                  )}

                  {datos.ultimasAsistencias.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center font-semibold text-slate-500"
                      >
                        Aún no hay asistencias registradas hoy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  </ProteccionRol>
);
}

function RiskCard({
  titulo,
  valor,
  icono,
  clase,
}: {
  titulo: string;
  valor: number;
  icono: string;
  clase: string;
}) {
  return (
    <div
       className={`rounded-2xl border p-3 text-center backdrop-blur-xl sm:p-5 ${clase}`}
    >
      <p className="text-xs font-bold text-white/90 sm:text-sm">
        {icono} {titulo}
      </p>

      <h3 className="mt-1 text-2xl font-black sm:mt-3 sm:text-5xl">{valor}</h3>
    </div>
  );
}

function CardDashboard({
  titulo,
  valor,
  color = "slate",
}: {
  titulo: string;
  valor: number;
  color?: ColorTarjeta;
}) {
  const estilos: Record<
    ColorTarjeta,
    {
      tarjeta: string;
      numero: string;
      icono: string;
      progreso: string;
    }
  > = {
    slate: {
      tarjeta: "from-slate-50 to-white border-slate-200",
      numero: "text-slate-900",
      icono: "bg-slate-900 shadow-slate-300",
      progreso: "bg-slate-900",
    },
    green: {
      tarjeta: "from-green-50 to-white border-green-200",
      numero: "text-green-700",
      icono: "bg-green-600 shadow-green-200",
      progreso: "bg-green-600",
    },
    emerald: {
      tarjeta: "from-emerald-50 to-white border-emerald-200",
      numero: "text-emerald-700",
      icono: "bg-emerald-600 shadow-emerald-200",
      progreso: "bg-emerald-600",
    },
    orange: {
      tarjeta: "from-orange-50 to-white border-orange-200",
      numero: "text-orange-600",
      icono: "bg-orange-500 shadow-orange-200",
      progreso: "bg-orange-500",
    },
    red: {
      tarjeta: "from-red-50 to-white border-red-200",
      numero: "text-red-600",
      icono: "bg-red-600 shadow-red-200",
      progreso: "bg-red-600",
    },
    blue: {
      tarjeta: "from-blue-50 to-white border-blue-200",
      numero: "text-blue-700",
      icono: "bg-blue-600 shadow-blue-200",
      progreso: "bg-blue-600",
    },
    purple: {
      tarjeta: "from-purple-50 to-white border-purple-200",
      numero: "text-purple-700",
      icono: "bg-purple-600 shadow-purple-200",
      progreso: "bg-purple-600",
    },
    cyan: {
      tarjeta: "from-cyan-50 to-white border-cyan-200",
      numero: "text-cyan-700",
      icono: "bg-cyan-600 shadow-cyan-200",
      progreso: "bg-cyan-600",
    },
  };

  const estilo = estilos[color];
  const partes = titulo.split(" ");
  const icono = partes[0];
  const nombre = partes.slice(1).join(" ");

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-[0_10px_30px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.13)] ${estilo.tarjeta}`}
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/60" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-black text-slate-500">
            {nombre}
          </p>

          <h3 className={`mt-3 text-4xl font-black ${estilo.numero}`}>
            {valor}
          </h3>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white shadow-lg ${estilo.icono}`}
        >
          {icono}
        </div>
      </div>

      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${estilo.progreso}`}
          style={{
            width: valor > 0 ? `${Math.min(valor * 10, 100)}%` : "7%",
          }}
        />
      </div>
    </div>
  );
}

function InfoBox({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: string;
  clase: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${clase}`}>
      <p className="text-xs font-black uppercase tracking-wider opacity-70">
        {titulo}
      </p>

      <p className="mt-2 break-words text-base font-black">
        {valor}
      </p>
    </div>
  );
}

function AlertBox({
  texto,
  icono,
  clase,
}: {
  texto: string;
  icono: string;
  clase: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-black ${clase}`}
    >
      <span className="text-lg">{icono}</span>
      <span>{texto}</span>
    </div>
  );
}

function TurnoDato({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: number;
  clase: string;
}) {
  return (
    <div className={`rounded-2xl p-3 ${clase}`}>
      <p className="text-xs font-bold opacity-70">{titulo}</p>
      <p className="mt-1 text-xl font-black">{valor}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const valor = estado.toUpperCase();

  if (valor === "PUNTUAL") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
        PUNTUAL
      </span>
    );
  }

  if (valor === "TARDE") {
    return (
      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
        TARDE
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
      {estado}
    </span>
  );
}