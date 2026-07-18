"use client";

import { useEffect, useState } from "react";
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
  "slate" | "green" | "emerald" | "orange" | "red" | "blue" | "purple" | "cyan";

const cardClass =
  "relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-[#081226]/90 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_24px_80px_rgba(37,99,235,0.18)]";

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

        setMensaje(`❌ ${data.message || "No se pudo cargar el dashboard"}`);

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
        ultimoReporteTelegramAt: data.ultimoReporteTelegramAt || null,
        ultimoReporteTelegramEstado: data.ultimoReporteTelegramEstado || "",

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
          data.resumenIA || "La IA aún no ha generado un resumen ejecutivo.",

        topRiesgoIA: Array.isArray(data.topRiesgoIA) ? data.topRiesgoIA : [],

        totalEsperadosHoy: data.totalEsperadosHoy || 0,
        diaNoLectivo: Boolean(data.diaNoLectivo),
        diaNoLectivoGeneral: Boolean(data.diaNoLectivoGeneral),

        eventosNoLectivosHoy: Array.isArray(data.eventosNoLectivosHoy)
          ? data.eventosNoLectivosHoy
          : [],
      });

      setMensaje("");
    } catch (error) {
      console.error("Error cargando dashboard:", error);

      setMensaje("⚠️ No se pudo conectar temporalmente con el servidor.");
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
        }),
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
      ? Math.round((datos.presentes / datos.totalEstudiantes) * 100)
      : 0;

  const datosGrafico = [
    { name: "Puntuales", value: datos.puntuales },
    { name: "Tardanzas", value: datos.tardanzas },
    { name: "Ausentes", value: datos.ausentes },
    { name: "Sin salida", value: datos.sinSalida },
  ];

  return (
    <ProteccionRol rolesPermitidos={["ADMIN", "DIRECTIVO", "DEMO"]}>
      <main className="relative min-h-screen overflow-hidden bg-[#020617] px-4 py-6 text-slate-100 md:px-7 lg:px-8">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -left-48 -top-48 h-[620px] w-[620px] rounded-full bg-blue-700/20 blur-[150px]" />
          <div className="absolute right-[-220px] top-[12%] h-[620px] w-[620px] rounded-full bg-violet-700/15 blur-[160px]" />
          <div className="absolute bottom-[-260px] left-[26%] h-[680px] w-[680px] rounded-full bg-cyan-600/10 blur-[170px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.045)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(30,64,175,0.16),transparent_38%)]" />
        </div>

        <div className="relative mx-auto max-w-[1700px] space-y-7">
          {mensaje && (
            <div className="dashboard-reveal rounded-2xl border border-red-500/30 bg-red-950/70 px-5 py-4 font-bold text-red-200 shadow-lg shadow-red-950/50 backdrop-blur-xl">
              {mensaje}
            </div>
          )}

          {/* CABECERA */}
          <section className="dashboard-reveal group relative overflow-hidden rounded-[34px] border border-blue-500/20 bg-gradient-to-r from-[#040b1d] via-[#07142d] to-[#0d1740] p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.48)] transition-all duration-700 hover:border-blue-400/35 hover:shadow-[0_32px_95px_rgba(37,99,235,0.22)] md:p-8">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-200">
                  Panel general
                </p>

                <div className="mt-4">
  <h1 className="text-3xl font-black tracking-tight md:text-4xl">
    Santa Rita de Cassia
  </h1>

  <p className="mt-2 text-sm font-medium text-slate-300 md:text-base">
    Sistema Inteligente de Control de Asistencia Escolar
  </p>
</div>
              </div>

              <div className="rounded-3xl border border-blue-400/20 bg-blue-500/10 px-6 py-4 text-left shadow-inner shadow-blue-400/5 backdrop-blur-xl lg:text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-300">
                  Hora actual
                </p>

                <h2 className="mt-2 text-3xl font-black tabular-nums md:text-4xl">
                  {horaActual}
                </h2>

                <p className="mt-1 text-sm text-blue-200">Hora local de Perú</p>
              </div>
            </div>
          </section>

          {/* DÍA NO LECTIVO */}
          {datos.diaNoLectivo && (
            <section className="dashboard-reveal dashboard-delay-1 rounded-[28px] border border-red-200/80 bg-gradient-to-r from-red-50/95 to-orange-50/95 p-6 shadow-[0_16px_45px_rgba(239,68,68,0.12)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-3xl text-white shadow-lg shadow-red-200">
                  📅
                </div>

                <div className="flex-1">
                  <h2 className="text-2xl font-black text-red-700 md:text-3xl">
                    Hoy es día no lectivo
                  </h2>

                  <p className="mt-2 font-semibold text-red-600">
                    La marcación y las alertas automáticas de ausencia están
                    suspendidas para los turnos correspondientes.
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
          <section className="dashboard-reveal dashboard-delay-1 group relative overflow-hidden rounded-[32px] border border-violet-500/30 bg-gradient-to-r from-[#11184a] via-[#321275] to-[#7a0fb6] p-4 text-white shadow-[0_22px_70px_rgba(88,28,135,0.38)] transition-all duration-700 hover:-translate-y-1 hover:border-fuchsia-400/45 hover:shadow-[0_30px_95px_rgba(168,85,247,0.30)] sm:p-5 md:p-7">
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
                    (window.location.href = "/dashboard/inteligencia")
                  }
                  className="rounded-2xl bg-gradient-to-r from-white to-violet-100 px-3 py-2 text-xs font-black text-violet-800 shadow-xl shadow-violet-950/30 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:from-violet-50 hover:to-fuchsia-100 active:scale-95 sm:px-5 sm:py-3 sm:text-base"
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

            <details className="mt-4 rounded-2xl border border-violet-300/20 bg-black/15 backdrop-blur-xl">
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
          <section
            className={`dashboard-reveal dashboard-delay-2 ${cardClass} p-6 md:p-7`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-black text-white">
                  🔥 Top Riesgo IA
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Estudiantes con mayor nivel preventivo detectado
                </p>
              </div>

              <button
                onClick={() =>
                  (window.location.href = "/dashboard/inteligencia/ranking")
                }
                className="rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-pink-600 px-5 py-3 font-black text-white shadow-lg shadow-rose-950/50 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_14px_38px_rgba(244,63,94,0.35)] active:scale-95"
              >
                Ver ranking completo
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {datos.topRiesgoIA.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-3xl border border-indigo-500/35 bg-gradient-to-br from-[#111b42] via-[#0b1531] to-[#081226] p-5 shadow-[0_16px_45px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-violet-400/55 hover:shadow-[0_20px_60px_rgba(99,102,241,0.22)]"
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/15 blur-xl" />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-black text-violet-300">
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

                    <h4 className="mt-4 min-h-[48px] font-black text-white">
                      {item.estudiante.nombres} {item.estudiante.apellidos}
                    </h4>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {item.estudiante.grado} - {item.estudiante.seccion}
                    </p>

                    <p className="mt-4 text-4xl font-black text-white">
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
                <div className="col-span-full rounded-3xl border border-slate-700 bg-slate-900/70 py-10 text-center font-semibold text-slate-400">
                  Aún no hay estudiantes con riesgo IA analizado.
                </div>
              )}
            </div>
          </section>

          {/* INDICADORES */}
          <section className="dashboard-reveal dashboard-delay-3 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
          <section className="dashboard-reveal dashboard-delay-4 grid gap-6 xl:grid-cols-2">
            <div className={`${cardClass} p-6 md:p-7`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white">
                    Reporte automático
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Estado y programación del último envío
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/10 text-2xl shadow-[0_0_28px_rgba(59,130,246,0.15)]">
                  📤
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <InfoBox
                  titulo="Próximo horario"
                  valor={datos.horaReporteDiario || "21:00"}
                  clase="border border-blue-500/25 bg-blue-500/10 text-blue-300"
                />

                <InfoBox
                  titulo="Último envío"
                  valor={fechaHora(datos.ultimoReporteTelegramAt)}
                  clase="border border-slate-600/50 bg-slate-800/70 text-slate-200"
                />

                <InfoBox
                  titulo="Estado"
                  valor={datos.ultimoReporteTelegramEstado || "Aún no enviado"}
                  clase="border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                />
              </div>
            </div>

            <div className={`${cardClass} p-6 md:p-7`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white">
                    Alertas del día
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Incidencias detectadas durante la jornada
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-2xl shadow-[0_0_28px_rgba(245,158,11,0.15)]">
                  ⚠️
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <AlertBox
                  texto={`${datos.ausentes} estudiantes ausentes`}
                  icono="❌"
                  clase="border-red-500/30 bg-red-500/10 text-red-300"
                />

                <AlertBox
                  texto={`${datos.tardanzas} tardanzas registradas`}
                  icono="🟠"
                  clase="border-orange-500/30 bg-orange-500/10 text-orange-300"
                />

                <AlertBox
                  texto={`${datos.sinSalida} estudiantes sin salida`}
                  icono="🔵"
                  clase="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                />
              </div>
            </div>
          </section>

          {/* GRÁFICO */}
          <section
            className={`dashboard-reveal dashboard-delay-4 ${cardClass} p-6 md:p-7`}
          >
            <div>
              <h3 className="text-2xl font-black text-white">
                📈 Gráfico de asistencia del día
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Comparación de puntualidad, tardanzas y ausencias
              </p>
            </div>

            <div className="mt-6 h-[340px] w-full rounded-3xl border border-blue-500/15 bg-gradient-to-br from-[#050d20] to-[#07152f] p-3 shadow-inner shadow-black/30">
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
                    stroke="#24324f"
                  />

                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "#94a3b8",
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
                    cursor={{ fill: "rgba(59,130,246,0.08)" }}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 15px 35px rgba(15,23,42,0.12)",
                    }}
                  />

                  <Bar
                    dataKey="value"
                    fill="#3b82f6"
                    radius={[14, 14, 4, 4]}
                    barSize={72}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* TURNOS */}
          <section
            className={`dashboard-reveal dashboard-delay-5 ${cardClass} p-6 md:p-7`}
          >
            <div>
              <h3 className="text-2xl font-black text-white">
                ⏰ Resumen por turnos
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Indicadores de asistencia separados por horario
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {datos.resumenTurnos.map((turno) => (
                <div
                  key={turno.id}
                  className={`rounded-3xl border p-6 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
                    turno.noLectivo
                      ? "border-red-500/35 bg-red-950/30"
                      : "border-slate-700/70 bg-gradient-to-br from-[#0b1730] to-[#071226]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-2xl font-black text-white">
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
                    <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/35 p-3 text-sm font-semibold text-red-300">
                      {turno.motivoNoLectivo ||
                        "Turno suspendido por calendario escolar"}
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <TurnoDato
                      titulo="Total"
                      valor={turno.total}
                      clase="border border-slate-600/50 bg-slate-800/70 text-slate-200"
                    />

                    <TurnoDato
                      titulo="Presentes"
                      valor={turno.presentes}
                      clase="border border-green-500/25 bg-green-500/10 text-green-300"
                    />

                    <TurnoDato
                      titulo="Ausentes"
                      valor={turno.ausentes}
                      clase="border border-red-500/25 bg-red-500/10 text-red-300"
                    />

                    <TurnoDato
                      titulo="Puntuales"
                      valor={turno.puntuales}
                      clase="border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    />

                    <TurnoDato
                      titulo="Tardanzas"
                      valor={turno.tardanzas}
                      clase="border border-orange-500/25 bg-orange-500/10 text-orange-300"
                    />

                    <TurnoDato
                      titulo="Sin salida"
                      valor={turno.sinSalida}
                      clase="border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                    />
                  </div>
                </div>
              ))}

              {datos.resumenTurnos.length === 0 && (
                <div className="col-span-full rounded-3xl border border-slate-700 bg-slate-900/70 py-10 text-center font-semibold text-slate-400">
                  No hay turnos disponibles.
                </div>
              )}
            </div>
          </section>

          {/* ASISTENCIA Y TABLA */}
          <section className="dashboard-reveal dashboard-delay-5 grid gap-6 xl:grid-cols-3">
            <div className={`${cardClass} p-6 md:p-7`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white">
                    Asistencia de hoy
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Porcentaje general de estudiantes presentes
                  </p>
                </div>

                <div className="rounded-2xl border border-green-400/25 bg-green-500/10 p-3 text-2xl">📌</div>
              </div>

              <div className="mt-8 text-center">
                <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 p-3 shadow-[0_0_55px_rgba(34,197,94,0.25)]">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-green-400/20 bg-[#071226]">
                    <span className="text-4xl font-black text-white">
                      {porcentajePresentes}%
                    </span>

                    <span className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                      presentes
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-7 h-3 overflow-hidden rounded-full bg-slate-800">
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
                <h3 className="text-2xl font-black text-white">
                  🕒 Últimas asistencias
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Registros recientes de entrada y salida
                </p>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-700 bg-[#071226]">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="bg-[#030817] text-white">
                    <tr>
                      <th className="px-4 py-4 text-sm">Hora</th>
                      <th className="px-4 py-4 text-sm">Estudiante</th>
                      <th className="px-4 py-4 text-sm">Turno</th>
                      <th className="px-4 py-4 text-sm">Estado</th>
                      <th className="px-4 py-4 text-sm">Tipo</th>
                      <th className="px-4 py-4 text-sm">Método</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {datos.ultimasAsistencias.map((asistencia, index) => (
                      <tr
  key={asistencia.id}
  className={`transition duration-300 hover:bg-blue-500/10 ${
    index % 2 === 0
      ? "bg-[#081226]"
      : "bg-[#0b1730]"
  }`}
>
                        <td className="px-4 py-4 font-bold text-slate-200">
                          {hora(
                            asistencia.horaSalida || asistencia.horaEntrada,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black text-white">
                            {asistencia.estudiante.nombres}{" "}
                            {asistencia.estudiante.apellidos}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {asistencia.estudiante.grado} -{" "}
                            {asistencia.estudiante.seccion}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-300">
                          {asistencia.estudiante.turno?.nombre || "Sin turno"}
                        </td>

                        <td className="px-4 py-4">
                          <EstadoBadge estado={asistencia.estado} />
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">
                            {tipo(asistencia)}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-300">
                          {asistencia.metodo}
                        </td>
                      </tr>
                    ))}

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

        <style jsx global>{`
          @keyframes dashboardReveal {
            from {
              opacity: 0;
              transform: translateY(24px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes premiumGlow {
            0%,
            100% {
              opacity: 0.45;
              transform: scale(1);
            }
            50% {
              opacity: 0.8;
              transform: scale(1.08);
            }
          }

          @keyframes neonPulse {
            0%,
            100% {
              filter: drop-shadow(0 0 0 rgba(59, 130, 246, 0));
            }
            50% {
              filter: drop-shadow(0 0 14px rgba(59, 130, 246, 0.28));
            }
          }

          @keyframes backgroundDrift {
            0% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(0, -8px, 0);
            }
            100% {
              transform: translate3d(0, 0, 0);
            }
          }

          .dashboard-neon {
            animation: neonPulse 3.2s ease-in-out infinite;
          }

          .dashboard-reveal {
            opacity: 0;
            animation: dashboardReveal 0.75s cubic-bezier(0.22, 1, 0.36, 1)
              forwards;
          }

          .dashboard-delay-1 {
            animation-delay: 0.08s;
          }
          .dashboard-delay-2 {
            animation-delay: 0.16s;
          }
          .dashboard-delay-3 {
            animation-delay: 0.24s;
          }
          .dashboard-delay-4 {
            animation-delay: 0.32s;
          }
          .dashboard-delay-5 {
            animation-delay: 0.4s;
          }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-reveal {
              opacity: 1;
              animation: none;
            }
          }
        `}</style>
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
      className={`group rounded-2xl border p-3 text-center backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/20 hover:shadow-xl sm:p-5 ${clase}`}
    >
      <p className="text-xs font-bold text-white/90 sm:text-sm">
        {icono} {titulo}
      </p>

      <h3 className="mt-1 text-2xl font-black tabular-nums transition-transform duration-300 group-hover:scale-110 sm:mt-3 sm:text-5xl">
        {valor}
      </h3>
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
      brillo: string;
    }
  > = {
    slate: {
      tarjeta: "border-violet-500/45 bg-gradient-to-br from-violet-950/55 via-[#0b1531] to-[#071226]",
      numero: "text-violet-200",
      icono: "border border-violet-400/35 bg-violet-500/15 text-violet-300 shadow-[0_0_28px_rgba(139,92,246,0.25)]",
      progreso: "bg-violet-400",
      brillo: "bg-violet-500/10",
    },
    green: {
      tarjeta: "border-green-500/45 bg-gradient-to-br from-green-950/50 via-[#071c20] to-[#071226]",
      numero: "text-green-300",
      icono: "border border-green-400/35 bg-green-500/15 text-green-300 shadow-[0_0_28px_rgba(34,197,94,0.25)]",
      progreso: "bg-green-400",
      brillo: "bg-green-500/10",
    },
    emerald: {
      tarjeta: "border-emerald-500/45 bg-gradient-to-br from-emerald-950/50 via-[#071d20] to-[#071226]",
      numero: "text-emerald-300",
      icono: "border border-emerald-400/35 bg-emerald-500/15 text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,0.25)]",
      progreso: "bg-emerald-400",
      brillo: "bg-emerald-500/10",
    },
    orange: {
      tarjeta: "border-orange-500/45 bg-gradient-to-br from-orange-950/45 via-[#21140a] to-[#071226]",
      numero: "text-orange-300",
      icono: "border border-orange-400/35 bg-orange-500/15 text-orange-300 shadow-[0_0_28px_rgba(249,115,22,0.25)]",
      progreso: "bg-orange-400",
      brillo: "bg-orange-500/10",
    },
    red: {
      tarjeta: "border-rose-500/45 bg-gradient-to-br from-rose-950/45 via-[#25101b] to-[#071226]",
      numero: "text-rose-300",
      icono: "border border-rose-400/35 bg-rose-500/15 text-rose-300 shadow-[0_0_28px_rgba(244,63,94,0.25)]",
      progreso: "bg-rose-400",
      brillo: "bg-rose-500/10",
    },
    blue: {
      tarjeta: "border-blue-500/45 bg-gradient-to-br from-blue-950/55 via-[#081a36] to-[#071226]",
      numero: "text-blue-300",
      icono: "border border-blue-400/35 bg-blue-500/15 text-blue-300 shadow-[0_0_28px_rgba(59,130,246,0.25)]",
      progreso: "bg-blue-400",
      brillo: "bg-blue-500/10",
    },
    purple: {
      tarjeta: "border-fuchsia-500/45 bg-gradient-to-br from-fuchsia-950/45 via-[#211038] to-[#071226]",
      numero: "text-fuchsia-300",
      icono: "border border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-300 shadow-[0_0_28px_rgba(217,70,239,0.25)]",
      progreso: "bg-fuchsia-400",
      brillo: "bg-fuchsia-500/10",
    },
    cyan: {
      tarjeta: "border-cyan-500/45 bg-gradient-to-br from-cyan-950/45 via-[#08202d] to-[#071226]",
      numero: "text-cyan-300",
      icono: "border border-cyan-400/35 bg-cyan-500/15 text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.25)]",
      progreso: "bg-cyan-400",
      brillo: "bg-cyan-500/10",
    },
  };

  const estilo = estilos[color];
  const partes = titulo.split(" ");
  const icono = partes[0];
  const nombre = partes.slice(1).join(" ");

  return (
    <div
      className={`group relative overflow-hidden rounded-[26px] border p-5 shadow-[0_16px_45px_rgba(0,0,0,0.34)] transition-all duration-500 hover:-translate-y-2 hover:scale-[1.01] hover:shadow-[0_24px_65px_rgba(37,99,235,0.16)] ${estilo.tarjeta}`}
    >
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl ${estilo.brillo}`} />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-black text-slate-400">{nombre}</p>

          <h3 className={`mt-3 text-4xl font-black ${estilo.numero}`}>
            {valor}
          </h3>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl shadow-lg transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 ${estilo.icono}`}
        >
          {icono}
        </div>
      </div>

      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800">
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
    <div
      className={`rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${clase}`}
    >
      <p className="text-xs font-black uppercase tracking-wider opacity-70">
        {titulo}
      </p>

      <p className="mt-2 break-words text-base font-black">{valor}</p>
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
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-black transition-all duration-300 hover:translate-x-1 hover:shadow-sm ${clase}`}
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
    <div
      className={`rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm ${clase}`}
    >
      <p className="text-xs font-bold opacity-70">{titulo}</p>
      <p className="mt-1 text-xl font-black">{valor}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const valor = estado.toUpperCase();

  if (valor === "PUNTUAL") {
    return (
      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
        PUNTUAL
      </span>
    );
  }

  if (valor === "TARDE") {
    return (
      <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
        TARDE
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-500/30 bg-slate-700/50 px-3 py-1 text-xs font-black text-slate-200">
      {estado}
    </span>
  );
}