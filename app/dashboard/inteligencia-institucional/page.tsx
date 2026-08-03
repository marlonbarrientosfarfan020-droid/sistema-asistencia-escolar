"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ProteccionRol from "@/components/auth/ProteccionRol";

type Data = any;

const INICIAL: Data = {
  institucion: { nombre: "Institución educativa" },
  resumen: {
    totalEstudiantes: 0,
    estudiantesAnalizados: 0,
    riesgoAlto: 0,
    riesgoMedio: 0,
    riesgoBajo: 0,
    riesgoPromedio: 0,
    coberturaTelegram: 0,
    historialEnviados: 0,
    historialErrores: 0,
    historialOmitidos: 0,
    tasaExito: 0,
  },
  configuracionReportes: {
    director: {
      activo: false,
      frecuencia: "SEMANAL",
      hora: "18:00",
      proximoEnvio: null,
      ultimoEnvio: null,
      ultimoEstado: "",
      excel: true,
      pdf: true,
      chatConfigurado: false,
    },
    padres: {
      activo: false,
      frecuencia: "SEMANAL",
      hora: "19:00",
      proximoEnvio: null,
      ultimoEnvio: null,
      incluirRiesgo: true,
    },
  },
  analitica: {
    riesgoDistribucion: [],
    riesgoPorTurno: [],
    seccionesCriticas: [],
    tendencia30: [],
    reportesPorDia: [],
    erroresPorCausa: [],
  },
  topRiesgo: [],
  historial: [],
  resumenIA: "Todavía no existe un análisis general generado por IA.",
};

const PANEL =
  "rounded-[26px] border border-slate-800/90 bg-[#07111f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.32)]";

const COLORES = ["#f43f5e", "#f97316", "#22c55e"];

export default function InteligenciaInstitucionalPage() {
  const [datos, setDatos] = useState(INICIAL);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [mostrarResumen, setMostrarResumen] = useState(false);

  async function cargar() {
    try {
      const res = await fetch("/api/inteligencia-institucional", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMensaje(`❌ ${data.message || "No se pudo cargar el módulo"}`);
        return;
      }

      setDatos(data);
      setMensaje("");
    } catch {
      setMensaje("❌ No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
  }, []);

  const estabilidad = useMemo(() => {
    const total = datos.resumen.estudiantesAnalizados;
    if (!total) return 0;
    return Math.round(
      ((datos.resumen.riesgoBajo + datos.resumen.riesgoMedio * 0.5) / total) * 100
    );
  }, [datos]);

  function fechaHora(fecha?: string | null) {
    if (!fecha) return "Sin registro";
    return new Date(fecha).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    });
  }

  return (
    <ProteccionRol rolesPermitidos={["ADMIN", "DIRECTIVO", "DEMO"]}>
      <main className="min-h-screen bg-[#020806] text-slate-100">
        <div className="mx-auto max-w-[1920px] space-y-4 px-3 py-4 sm:px-5 lg:px-6">
          <header className={`${PANEL} overflow-hidden`}>
            <div className="grid gap-5 bg-gradient-to-r from-[#10194d] via-[#31136e] to-[#70119a] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-violet-200">
                  Analítica predictiva + reportes automáticos
                </p>
                <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
                  🧠 Inteligencia Institucional IA
                </h1>
                <p className="mt-2 max-w-4xl text-sm font-semibold text-violet-100/80">
                  Riesgos, tendencias, cobertura de comunicación y desempeño de los reportes inteligentes.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/20 px-5 py-4 text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-200">
                  Estabilidad institucional
                </p>
                <p className="mt-1 text-4xl font-black text-white">{estabilidad}%</p>
                <p className="mt-1 text-xs font-semibold text-violet-100/70">
                  {datos.institucion.nombre}
                </p>
              </div>
            </div>
          </header>

          {mensaje && (
            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-4 font-bold text-blue-100">
              {mensaje}
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Kpi titulo="Analizados IA" valor={datos.resumen.estudiantesAnalizados} icono="🧠" clase="border-violet-500/30 bg-violet-500/10 text-violet-300" />
            <Kpi titulo="Riesgo alto" valor={datos.resumen.riesgoAlto} icono="🔴" clase="border-red-500/30 bg-red-500/10 text-red-300" />
            <Kpi titulo="Riesgo medio" valor={datos.resumen.riesgoMedio} icono="🟠" clase="border-orange-500/30 bg-orange-500/10 text-orange-300" />
            <Kpi titulo="Riesgo bajo" valor={datos.resumen.riesgoBajo} icono="🟢" clase="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
            <Kpi titulo="Cobertura Telegram" valor={`${datos.resumen.coberturaTelegram}%`} icono="📲" clase="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" />
            <Kpi titulo="Éxito reportes" valor={`${datos.resumen.tasaExito}%`} icono="📨" clase="border-blue-500/30 bg-blue-500/10 text-blue-300" />
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-4`}>
              <Titulo titulo="Distribución de riesgo" subtitulo="Clasificación actual de estudiantes" />
              <div className="relative mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datos.analitica.riesgoDistribucion} dataKey="valor" nameKey="nombre" innerRadius={72} outerRadius={112} paddingAngle={5} stroke="transparent">
                      {datos.analitica.riesgoDistribucion.map((item: any, i: number) => (
                        <Cell key={item.nombre} fill={COLORES[i % COLORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10">
                  <div className="text-center">
                    <p className="text-4xl font-black text-white">{datos.resumen.riesgoPromedio}%</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">riesgo promedio</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-8`}>
              <Titulo titulo="Tendencia predictiva de 30 días" subtitulo="Asistencia, ausencias y tardanzas" />
              <div className="mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datos.analitica.tendencia30}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: "#94a3b8", fontSize: 10 }} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="presentes" name="Presentes" stroke="#22c55e" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="ausentes" name="Ausentes" stroke="#f43f5e" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="tardanzas" name="Tardanzas" stroke="#f97316" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <Titulo titulo="Riesgo por turno" subtitulo="Alto, medio y bajo por jornada" />
              <div className="mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.analitica.riesgoPorTurno}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="turno" tick={{ fill: "#cbd5e1", fontWeight: 700 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="alto" name="Alto" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="medio" name="Medio" fill="#f97316" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="bajo" name="Bajo" fill="#22c55e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <Titulo titulo="Secciones prioritarias" subtitulo="Mayor concentración de riesgo" />
              <div className="mt-4 max-h-[310px] space-y-2 overflow-y-auto pr-1">
                {datos.analitica.seccionesCriticas.map((item: any, i: number) => (
                  <div key={item.etiqueta} className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-white">{i + 1}. {item.etiqueta}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{item.cantidad} estudiantes analizados</p>
                      </div>
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-300">
                        {item.promedio}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Mini etiqueta="Alto" valor={item.alto} clase="text-red-300" />
                      <Mini etiqueta="Medio" valor={item.medio} clase="text-orange-300" />
                      <Mini etiqueta="Bajo" valor={item.bajo} clase="text-emerald-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <Titulo titulo="Rendimiento de reportes automáticos" subtitulo="Enviados, omitidos y errores de los últimos 14 días" />
              <div className="mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.analitica.reportesPorDia}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: "#94a3b8", fontSize: 10 }} minTickGap={18} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="enviados" name="Enviados" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="omitidos" name="Omitidos" fill="#eab308" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="errores" name="Errores" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <Titulo titulo="Resultado histórico" subtitulo="Cobertura de los procesos registrados" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                <Resumen titulo="Enviados" valor={datos.resumen.historialEnviados} clase="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
                <Resumen titulo="Omitidos" valor={datos.resumen.historialOmitidos} clase="border-yellow-500/30 bg-yellow-500/10 text-yellow-300" />
                <Resumen titulo="Errores" valor={datos.resumen.historialErrores} clase="border-red-500/30 bg-red-500/10 text-red-300" />
              </div>
              <div className="mt-5 space-y-3">
                {datos.analitica.erroresPorCausa.map((item: any) => (
                  <div key={item.causa} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                    <span className="font-bold text-slate-400">{item.causa}</span>
                    <span className="font-black text-white">{item.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-8`}>
              <Titulo
                titulo="Programación de reportes inteligentes"
                subtitulo="Próximos envíos automáticos para dirección y familias"
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ProgramacionReporte
                  titulo="Reporte ejecutivo del director"
                  icono="🏫"
                  activo={datos.configuracionReportes.director.activo}
                  frecuencia={datos.configuracionReportes.director.frecuencia}
                  hora={datos.configuracionReportes.director.hora}
                  proximo={datos.configuracionReportes.director.proximoEnvio}
                  ultimo={datos.configuracionReportes.director.ultimoEnvio}
                  etiquetas={[
                    datos.configuracionReportes.director.excel
                      ? "Excel activo"
                      : "Excel inactivo",
                    datos.configuracionReportes.director.pdf
                      ? "PDF activo"
                      : "PDF inactivo",
                    datos.configuracionReportes.director.chatConfigurado
                      ? "Telegram configurado"
                      : "Telegram pendiente",
                  ]}
                  fechaHora={fechaHora}
                />

                <ProgramacionReporte
                  titulo="Reportes automáticos para padres"
                  icono="👨‍👩‍👧‍👦"
                  activo={datos.configuracionReportes.padres.activo}
                  frecuencia={datos.configuracionReportes.padres.frecuencia}
                  hora={datos.configuracionReportes.padres.hora}
                  proximo={datos.configuracionReportes.padres.proximoEnvio}
                  ultimo={datos.configuracionReportes.padres.ultimoEnvio}
                  etiquetas={[
                    datos.configuracionReportes.padres.incluirRiesgo
                      ? "Incluye riesgo IA"
                      : "Sin riesgo IA",
                    `${datos.resumen.totalEstudiantes} estudiantes`,
                    `${datos.resumen.coberturaTelegram}% cobertura`,
                  ]}
                  fechaHora={fechaHora}
                />
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-4`}>
              <Titulo
                titulo="Salud de la comunicación"
                subtitulo="Cobertura y efectividad de los reportes"
              />

              <div className="mt-6 space-y-5">
                <IndicadorCircular
                  titulo="Cobertura Telegram"
                  valor={datos.resumen.coberturaTelegram}
                  detalle={`${datos.resumen.totalEstudiantes} estudiantes activos`}
                />

                <IndicadorCircular
                  titulo="Éxito de entrega"
                  valor={datos.resumen.tasaExito}
                  detalle={`${datos.resumen.historialEnviados} reportes enviados`}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Resumen
                    titulo="Omitidos"
                    valor={datos.resumen.historialOmitidos}
                    clase="border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                  />

                  <Resumen
                    titulo="Errores"
                    valor={datos.resumen.historialErrores}
                    clase="border-red-500/30 bg-red-500/10 text-red-300"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <Titulo
                titulo="Ranking preventivo de estudiantes"
                subtitulo="Barras horizontales con los casos de mayor riesgo real"
              />

              {datos.topRiesgo.length > 0 ? (
                <div className="mt-5 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={datos.topRiesgo.slice(0, 8).map((item: any) => ({
                        ...item,
                        nombre: `${item.estudiante.nombres} ${item.estudiante.apellidos}`,
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid
                        stroke="#17312b"
                        strokeDasharray="4 4"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(valor) => `${valor}%`}
                      />

                      <YAxis
                        type="category"
                        dataKey="nombre"
                        width={155}
                        tick={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 700 }}
                      />

                      <Tooltip
                        formatter={(valor: any) => [`${valor}%`, "Riesgo"]}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload;
                          return item
                            ? `${item.estudiante.grado}° ${item.estudiante.seccion} · ${item.estudiante.turno || "Sin turno"}`
                            : "";
                        }}
                      />

                      <Bar
                        dataKey="porcentaje"
                        name="Riesgo"
                        radius={[0, 10, 10, 0]}
                        barSize={22}
                      >
                        {datos.topRiesgo.slice(0, 8).map((item: any) => (
                          <Cell
                            key={item.id}
                            fill={
                              item.nivel === "ALTO"
                                ? "#f43f5e"
                                : item.nivel === "MEDIO"
                                ? "#f97316"
                                : "#22c55e"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 py-14 text-center">
                  <p className="text-5xl">✅</p>
                  <p className="mt-4 text-xl font-black text-emerald-300">
                    Sin estudiantes prioritarios
                  </p>
                  <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">
                    Actualmente no existen riesgos altos, medios ni porcentajes mayores a cero.
                  </p>
                </div>
              )}
            </div>

            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <Titulo
                titulo="Estado institucional IA"
                subtitulo="Hallazgos actuales y recomendación principal"
              />

              <div className="mt-5 grid grid-cols-3 gap-3">
                <Hallazgo
                  titulo="Riesgo alto"
                  valor={datos.resumen.riesgoAlto}
                  clase="border-red-500/30 bg-red-500/10 text-red-300"
                />
                <Hallazgo
                  titulo="Riesgo medio"
                  valor={datos.resumen.riesgoMedio}
                  clase="border-orange-500/30 bg-orange-500/10 text-orange-300"
                />
                <Hallazgo
                  titulo="Riesgo bajo"
                  valor={datos.resumen.riesgoBajo}
                  clase="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                />
              </div>

              <div className="mt-4 rounded-3xl border border-violet-500/25 bg-violet-500/10 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-2xl">
                    💡
                  </div>
                  <div>
                    <p className="font-black text-white">Recomendación principal</p>
                    <p className="text-xs font-semibold text-violet-300">
                      Basada en los estudiantes activos actuales
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-200">
                  {datos.resumen.riesgoAlto > 0
                    ? "Priorizar el seguimiento inmediato de los estudiantes con riesgo alto y coordinar acciones con sus tutores."
                    : datos.resumen.riesgoMedio > 0
                    ? "Mantener seguimiento preventivo a los estudiantes con riesgo medio y revisar su evolución semanal."
                    : "Mantener el monitoreo periódico y actualizar el análisis después de registrar nuevas asistencias."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarResumen(true)}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 font-black text-white transition hover:-translate-y-0.5"
              >
                Ver informe ejecutivo completo
              </button>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <Titulo
                titulo="Estado de los reportes"
                subtitulo="Distribución histórica de procesos registrados"
              />

              <div className="relative mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { nombre: "Enviados", valor: datos.resumen.historialEnviados },
                        { nombre: "Errores", valor: datos.resumen.historialErrores },
                        { nombre: "Omitidos", valor: datos.resumen.historialOmitidos },
                      ]}
                      dataKey="valor"
                      nameKey="nombre"
                      innerRadius={68}
                      outerRadius={105}
                      paddingAngle={5}
                      stroke="transparent"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#f43f5e" />
                      <Cell fill="#eab308" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10">
                  <div className="text-center">
                    <p className="text-4xl font-black text-white">
                      {datos.resumen.tasaExito}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      éxito de entrega
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Titulo
                  titulo="Actividad reciente de reportes"
                  subtitulo="Últimos seis procesos para padres y directivos"
                />

                <button
                  type="button"
                  onClick={() => (window.location.href = "/dashboard/configuracion")}
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-black text-blue-300"
                >
                  Ver configuración
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {datos.historial.slice(0, 6).map((item: any) => (
                  <ActividadReporte
                    key={item.id}
                    fecha={fechaHora(item.createdAt)}
                    tipo={item.tipo.replaceAll("_", " ")}
                    destinatario={item.destinatario}
                    estado={item.estado}
                    detalle={item.detalle}
                  />
                ))}

                {datos.historial.length === 0 && (
                  <Vacio texto="Todavía no existen reportes registrados." />
                )}
              </div>
            </div>
          </section>

          {mostrarResumen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-violet-500/30 bg-[#07111f] p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">
                      Inteligencia institucional
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Informe ejecutivo completo
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMostrarResumen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-xl text-white"
                    aria-label="Cerrar informe"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5">
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-200">
                    {datos.resumenIA}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => (window.location.href = "/dashboard/inteligencia")}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 font-black text-white"
                >
                  Abrir Centro de Inteligencia Escolar
                </button>
              </div>
            </div>
          )}
</div>
        {cargando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <div className="rounded-3xl border border-violet-500/30 bg-[#07111f] px-8 py-6 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-violet-400" />
              <p className="mt-4 font-black text-white">Cargando inteligencia institucional...</p>
            </div>
          </div>
        )}
      </main>
    </ProteccionRol>
  );
}
function Vacio({
  texto,
}: {
  texto: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-10 text-center">
      <div className="text-4xl">
        📭
      </div>

      <p className="mt-3 text-sm font-bold text-slate-400">
        {texto}
      </p>
    </div>
  );
}
function Kpi({ titulo, valor, icono, clase }: any) {
  return <div className={`rounded-2xl border p-4 ${clase}`}><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider opacity-75">{titulo}</p><p className="mt-2 text-3xl font-black">{valor}</p></div><span className="text-2xl">{icono}</span></div></div>;
}
function Titulo({ titulo, subtitulo }: any) {
  return <div><h2 className="text-xl font-black text-white">{titulo}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{subtitulo}</p></div>;
}
function Mini({ etiqueta, valor, clase }: any) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{etiqueta}</p><p className={`mt-1 text-xl font-black ${clase}`}>{valor}</p></div>;
}
function Resumen({ titulo, valor, clase }: any) {
  return <div className={`rounded-2xl border p-4 text-center ${clase}`}><p className="text-xs font-black uppercase tracking-wider opacity-75">{titulo}</p><p className="mt-2 text-3xl font-black">{valor}</p></div>;
}
function ProgramacionReporte({
  titulo,
  icono,
  activo,
  frecuencia,
  hora,
  proximo,
  ultimo,
  etiquetas,
  fechaHora,
}: {
  titulo: string;
  icono: string;
  activo: boolean;
  frecuencia: string;
  hora: string;
  proximo: string | null;
  ultimo: string | null;
  etiquetas: string[];
  fechaHora: (fecha?: string | null) => string;
}) {
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
            {icono}
          </div>

          <div>
            <h3 className="font-black text-white">{titulo}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Programación automática
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${
            activo
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {activo ? "ACTIVO" : "INACTIVO"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniDato etiqueta="Frecuencia" valor={frecuencia} />
        <MiniDato etiqueta="Hora" valor={hora} />
      </div>

      <div className="mt-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
          Próximo envío
        </p>
        <p className="mt-2 text-lg font-black text-white">
          {fechaHora(proximo)}
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Último: {fechaHora(ultimo)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {etiquetas.map((etiqueta) => (
          <span
            key={etiqueta}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300"
          >
            {etiqueta}
          </span>
        ))}
      </div>
    </article>
  );
}

function IndicadorCircular({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: number;
  detalle: string;
}) {
  const porcentaje = Math.max(0, Math.min(100, Number(valor) || 0));

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#8b5cf6 ${porcentaje}%, #172033 ${porcentaje}% 100%)`,
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#07111f]">
          <span className="text-lg font-black text-white">{porcentaje}%</span>
        </div>
      </div>

      <div>
        <p className="font-black text-white">{titulo}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{detalle}</p>
      </div>
    </div>
  );
}

function MiniDato({ etiqueta, valor }: any) {
  return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{etiqueta}</p><p className="mt-2 text-sm font-black text-white">{valor}</p></div>;
}

function Hallazgo({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: number;
  clase: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${clase}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-75">
        {titulo}
      </p>
      <p className="mt-2 text-3xl font-black">{valor}</p>
    </div>
  );
}

function ActividadReporte({
  fecha,
  tipo,
  destinatario,
  estado,
  detalle,
}: {
  fecha: string;
  tipo: string;
  destinatario: string;
  estado: string;
  detalle: string;
}) 
{
  const enviado = estado === "ENVIADO";
  const error = estado === "ERROR";

  return (
    <article className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div
        className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
          enviado
            ? "bg-emerald-500/15 text-emerald-300"
            : error
            ? "bg-red-500/15 text-red-300"
            : "bg-yellow-500/15 text-yellow-300"
        }`}
      >
        {enviado ? "✓" : error ? "!" : "•"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-black text-white">
              {tipo} · {destinatario}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{fecha}</p>
          </div>

          <span
            className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black ${
              enviado
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : error
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
            }`}
          >
            {estado.replaceAll("_", " ")}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
          {detalle}
        </p>
      </div>
    </article>
  );
}
