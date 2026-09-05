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
  RadialBar,
  RadialBarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ProteccionRol from "@/components/auth/ProteccionRol";

type ResumenEstado = {
  total: number;
  presentes: number;
  puntuales: number;
  tardanzas: number;
  pendientesInicio: number;
  esperandoIngreso: number;
  ingresoPendiente: number;
  tardanzaSinIngreso: number;
  ausentesConfirmados: number;
  entradas?: number;
  salidas?: number;
  salidasRegistradas?: number;
  pendientesSalida?: number;
  jornadaCompleta?: number;
  sinSalida: number;
  alertasIngresoPendiente: number;
  alertasTardanza: number;
  alertasAusencia: number;
  alertasEnviadas: number;
};

type SeccionResumen = ResumenEstado & {
  grado: string;
  seccion: string;
  ausentes: number;
};

type TurnoResumen = ResumenEstado & {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  minutosAlertaInicial: number;
  margenAlertaMinutos: number;
  activo: boolean;
  noLectivo?: boolean;
  motivoNoLectivo?: string;
  ausentes: number;
  secciones: SeccionResumen[];
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

type TendenciaSemanal = {
  fecha: string;
  dia: string;
  total: number;
  presentes: number;
  ausentes: number;
  puntuales: number;
  tardanzas: number;
  porcentaje: number;
};

type AlertaReciente = {
  id: number;
  tipo: string;
  fecha: string;
  createdAt: string;
  estudiante: {
    id: number;
    codigo: string;
    dni: string;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    tutor: string;
    telegramChatId: string;
    turno: {
      id: number;
      nombre: string;
    } | null;
  };
};

type ResumenAlertas = {
  ingresoPendiente: number;
  tardanza: number;
  ausencia: number;
  total: number;
};

type EstadoAutomatizaciones = {
  activas: boolean;
  modoPrueba: boolean;
  ultimaEjecucion: string | null;
  ultimoEstado: string;
  frecuenciaMinutos: number;
};

type DashboardData = {
  fecha?: string;
  actualizadoEn?: string;
  totalEstudiantes: number;
  totalEsperadosHoy: number;
  presentes: number;
  puntuales: number;
  tardanzas: number;
  ausentes: number;
  entradas: number;
  salidas: number;
  salidasRegistradas: number;
  pendientesSalida: number;
  jornadaCompleta: number;
  sinSalida: number;
  pendientesInicio: number;
  esperandoIngreso: number;
  ingresoPendiente: number;
  tardanzaSinIngreso: number;
  ausentesConfirmados: number;
  sinIngreso: number;
  alertas: ResumenAlertas;
  automatizaciones: EstadoAutomatizaciones;
  horaReporteDiario?: string;
  ultimoReporteTelegramAt?: string | null;
  ultimoReporteTelegramEstado?: string;
  resumenTurnos: TurnoResumen[];
  resumenGrados: ResumenGrado[];
  ultimasAsistencias: Asistencia[];
  ultimasAlertas: AlertaReciente[];
  riesgoAlto?: number;
  riesgoMedio?: number;
  riesgoBajo?: number;
  resumenIA?: string;
  topRiesgoIA: RiesgoIA[];
  diaNoLectivo?: boolean;
  diaNoLectivoGeneral?: boolean;
  eventosNoLectivosHoy?: EventoNoLectivo[];
  tendenciaSemanal: TendenciaSemanal[];
};

type ResumenGrado = {
  grado: string;
  turnos: string[];
  secciones: string[];
  total: number;
  presentes: number;
  puntuales: number;
  tardanzas: number;
  sinIngreso: number;
  tardanzaSinIngreso: number;
  ausentesConfirmados: number;
  alertasEnviadas: number;
  porcentaje: number;
};

type Filtro = {
  turno: string;
  grado: string;
  seccion: string;
};

const ESTADO_INICIAL: DashboardData = {
  totalEstudiantes: 0,
  totalEsperadosHoy: 0,
  presentes: 0,
  puntuales: 0,
  tardanzas: 0,
  ausentes: 0,
  entradas: 0,
  salidas: 0,
  salidasRegistradas: 0,
  pendientesSalida: 0,
  jornadaCompleta: 0,
  sinSalida: 0,
  pendientesInicio: 0,
  esperandoIngreso: 0,
  ingresoPendiente: 0,
  tardanzaSinIngreso: 0,
  ausentesConfirmados: 0,
  sinIngreso: 0,
  alertas: {
    ingresoPendiente: 0,
    tardanza: 0,
    ausencia: 0,
    total: 0,
  },
  automatizaciones: {
    activas: false,
    modoPrueba: true,
    ultimaEjecucion: null,
    ultimoEstado: "",
    frecuenciaMinutos: 5,
  },
  horaReporteDiario: "21:00",
  ultimoReporteTelegramAt: null,
  ultimoReporteTelegramEstado: "",
  resumenTurnos: [],
  resumenGrados: [],
  ultimasAsistencias: [],
  ultimasAlertas: [],
  riesgoAlto: 0,
  riesgoMedio: 0,
  riesgoBajo: 0,
  resumenIA: "La IA aún no ha generado un resumen ejecutivo.",
  topRiesgoIA: [],
  diaNoLectivo: false,
  diaNoLectivoGeneral: false,
  eventosNoLectivosHoy: [],
  tendenciaSemanal: [],
};

const PANEL =
  "rounded-[26px] border border-slate-800/90 bg-[#07111f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl";

function numero(valor: unknown) {
  return Number(valor) || 0;
}

export default function Dashboard() {
  const [datos, setDatos] = useState<DashboardData>(ESTADO_INICIAL);
  const [mensaje, setMensaje] = useState("");
  const [horaActual, setHoraActual] = useState("");
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState<Filtro>({
    turno: "TODOS",
    grado: "TODOS",
    seccion: "TODAS",
  });

  async function cargarDashboard(signal?: AbortSignal) {
    if (typeof window !== "undefined" && localStorage.getItem("logueado") !== "true") {
      return;
    }

    try {
      const respuesta = await fetch("/api/dashboard", {
        headers: {
          "x-user-role": localStorage.getItem("rol") || "",
        },
        cache: "no-store",
        signal,
      });

      if (respuesta.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace("/login");
        }
        return;
      }

      const data = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setMensaje(`❌ ${data.message || "No se pudo cargar el dashboard"}`);
        return;
      }

      setDatos({
        fecha: data.fecha,
        actualizadoEn: data.actualizadoEn,
        totalEstudiantes: numero(data.totalEstudiantes),
        totalEsperadosHoy: numero(data.totalEsperadosHoy),
        presentes: numero(data.presentes),
        puntuales: numero(data.puntuales),
        tardanzas: numero(data.tardanzas),
        ausentes: numero(data.ausentes),
        entradas: numero(data.entradas),
        salidas: numero(data.salidas),
        salidasRegistradas: numero(data.salidasRegistradas ?? data.salidas),
        pendientesSalida: numero(data.pendientesSalida),
        jornadaCompleta: numero(data.jornadaCompleta ?? data.salidas),
        sinSalida: numero(data.sinSalida),
        pendientesInicio: numero(data.pendientesInicio),
        esperandoIngreso: numero(data.esperandoIngreso),
        ingresoPendiente: numero(data.ingresoPendiente),
        tardanzaSinIngreso: numero(data.tardanzaSinIngreso),
        ausentesConfirmados: numero(data.ausentesConfirmados),
        sinIngreso: numero(data.sinIngreso),
        alertas: {
          ingresoPendiente: numero(data.alertas?.ingresoPendiente),
          tardanza: numero(data.alertas?.tardanza),
          ausencia: numero(data.alertas?.ausencia),
          total: numero(data.alertas?.total),
        },
        automatizaciones: {
          activas: Boolean(data.automatizaciones?.activas),
          modoPrueba: data.automatizaciones?.modoPrueba ?? true,
          ultimaEjecucion: data.automatizaciones?.ultimaEjecucion || null,
          ultimoEstado: data.automatizaciones?.ultimoEstado || "",
          frecuenciaMinutos: numero(data.automatizaciones?.frecuenciaMinutos) || 5,
        },
        horaReporteDiario: data.horaReporteDiario || "21:00",
        ultimoReporteTelegramAt: data.ultimoReporteTelegramAt || null,
        ultimoReporteTelegramEstado: data.ultimoReporteTelegramEstado || "",
        resumenTurnos: Array.isArray(data.resumenTurnos)
          ? data.resumenTurnos
          : [],
        resumenGrados: Array.isArray(data.resumenGrados)
          ? data.resumenGrados
          : [],
        ultimasAsistencias: Array.isArray(data.ultimasAsistencias)
          ? data.ultimasAsistencias
          : [],
        ultimasAlertas: Array.isArray(data.ultimasAlertas)
          ? data.ultimasAlertas
          : [],
        riesgoAlto: numero(data.riesgoAlto),
        riesgoMedio: numero(data.riesgoMedio),
        riesgoBajo: numero(data.riesgoBajo),
        resumenIA:
          data.resumenIA || "La IA aún no ha generado un resumen ejecutivo.",
        topRiesgoIA: Array.isArray(data.topRiesgoIA) ? data.topRiesgoIA : [],
        diaNoLectivo: Boolean(data.diaNoLectivo),
        diaNoLectivoGeneral: Boolean(data.diaNoLectivoGeneral),
        eventosNoLectivosHoy: Array.isArray(data.eventosNoLectivosHoy)
          ? data.eventosNoLectivosHoy
          : [],
        tendenciaSemanal: Array.isArray(data.tendenciaSemanal)
          ? data.tendenciaSemanal
          : [],
      });

      setMensaje("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Error cargando dashboard:", error);
      setMensaje("⚠️ No se pudo conectar temporalmente con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let activo = true;
    const controller = new AbortController();

    if (localStorage.getItem("logueado") !== "true") {
      window.location.replace("/login");
      return;
    }

    void cargarDashboard(controller.signal);

    const datosIntervalo = setInterval(() => {
      if (activo && localStorage.getItem("logueado") === "true") {
        void cargarDashboard(controller.signal);
      }
    }, 5000);

    const relojIntervalo = setInterval(() => {
      if (activo) {
        setHoraActual(
          new Date().toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "America/Lima",
          }),
        );
      }
    }, 1000);

    setHoraActual(
      new Date().toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "America/Lima",
      }),
    );

    return () => {
      activo = false;
      controller.abort();
      clearInterval(datosIntervalo);
      clearInterval(relojIntervalo);
    };
  }, []);

  const turnosFiltrados = useMemo(() => {
    return datos.resumenTurnos.filter(
      (turno) => filtros.turno === "TODOS" || turno.nombre === filtros.turno,
    );
  }, [datos.resumenTurnos, filtros.turno]);

  const seccionesFiltradas = useMemo(() => {
    return turnosFiltrados.flatMap((turno) =>
      turno.secciones
        .filter(
          (item) => filtros.grado === "TODOS" || item.grado === filtros.grado,
        )
        .filter(
          (item) =>
            filtros.seccion === "TODAS" || item.seccion === filtros.seccion,
        )
        .map((item) => ({
          ...item,
          turno: turno.nombre,
          etiqueta: `${turno.nombre} · ${item.grado}° ${item.seccion}`,
          incidencias:
            item.tardanzaSinIngreso +
            item.ausentesConfirmados +
            item.tardanzas,
        })),
    );
  }, [turnosFiltrados, filtros.grado, filtros.seccion]);

  const grados = useMemo(
    () =>
      Array.from(
        new Set(datos.resumenTurnos.flatMap((turno) => turno.secciones.map((s) => s.grado))),
      ).sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
    [datos.resumenTurnos],
  );

  const secciones = useMemo(
    () =>
      Array.from(
        new Set(datos.resumenTurnos.flatMap((turno) => turno.secciones.map((s) => s.seccion))),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [datos.resumenTurnos],
  );

  const turnosGrafico = useMemo(
    () =>
      turnosFiltrados.map((turno) => ({
        ...turno,
        sinIngreso:
          turno.esperandoIngreso +
          turno.ingresoPendiente +
          turno.tardanzaSinIngreso,
      })),
    [turnosFiltrados],
  );

  const porcentajeAsistencia =
    datos.totalEsperadosHoy > 0
      ? Math.round((datos.presentes / datos.totalEsperadosHoy) * 100)
      : 0;

  const turnosJornadaGrafico = useMemo(
    () =>
      turnosFiltrados.map((turno) => ({
        nombre: turno.nombre,
        entradas: turno.entradas ?? turno.presentes,
        salidas: turno.salidasRegistradas ?? (turno.salidas ?? 0),
        pendientes:
          turno.pendientesSalida ??
          Math.max(turno.presentes - (turno.salidasRegistradas ?? turno.salidas ?? 0), 0),
        sinSalida: turno.sinSalida ?? 0,
      })),
    [turnosFiltrados],
  );

  const graficoEstadoActualEstudiantes = useMemo(
    () => [
      { name: "En Colegio", value: datos.pendientesSalida, color: "#10b981" },
      { name: "Jornada Completa", value: datos.jornadaCompleta, color: "#3b82f6" },
      { name: "Sin Salida", value: datos.sinSalida, color: "#f97316" },
      { name: "Sin Ingreso", value: datos.sinIngreso, color: "#64748b" },
    ],
    [datos.pendientesSalida, datos.jornadaCompleta, datos.sinSalida, datos.sinIngreso],
  );

  const graficoEstado = [
    { name: "Puntuales", value: datos.puntuales, color: "#10b981" },
    { name: "Tardes", value: datos.tardanzas, color: "#f97316" },
    {
      name: "Sin ingreso",
      value: datos.sinIngreso,
      color: "#facc15",
    },
    {
      name: "Ausentes",
      value: datos.ausentesConfirmados,
      color: "#f43f5e",
    },
  ];

  const graficoAlertas = [
    {
      name: "Avisos",
      value: datos.alertas.ingresoPendiente,
      color: "#facc15",
    },
    {
      name: "Tardanzas",
      value: datos.alertas.tardanza,
      color: "#f97316",
    },
    {
      name: "Ausencias",
      value: datos.alertas.ausencia,
      color: "#f43f5e",
    },
  ];

  const gradosGrafico = useMemo(() => {
    return datos.resumenGrados
      .filter(
        (item) =>
          filtros.grado ===
            "TODOS" ||
          item.grado ===
            filtros.grado
      )
      .map((item) => ({
        ...item,
        etiqueta:
          `${item.grado}°`,
      }));
  }, [
    datos.resumenGrados,
    filtros.grado,
  ]);

  const topSecciones = [...seccionesFiltradas]
    .sort((a, b) => b.incidencias - a.incidencias)
    .slice(0, 8);

  function hora(fecha: string | null | undefined) {
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

  return (
    <ProteccionRol rolesPermitidos={["ADMIN", "DIRECTIVO", "DEMO"]}>
      <main className="min-h-screen bg-[#020806] text-slate-100">
        <div className="mx-auto max-w-[1920px] px-3 py-3 sm:px-5 lg:px-6">
          <header className={`${PANEL} overflow-hidden`}>
            <div className="grid gap-4 border-b border-slate-800 px-5 py-5 lg:grid-cols-[1.4fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">
                  Centro de control en tiempo real
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl xl:text-4xl">
                  🏫 Centro de Monitoreo Escolar Inteligente
                </h1>
                <p className="mt-2 max-w-4xl text-sm font-medium text-slate-400">
                  Seguimiento operativo de asistencias, alertas automáticas,
                  turnos, grados, secciones e inteligencia escolar.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <EstadoChip
                  activo={datos.automatizaciones.activas}
                  textoActivo="Motor activo"
                  textoInactivo="Motor apagado"
                />
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Hora Perú
                  </p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">
                    {horaActual}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
              <FiltroSelect
                label="Turno"
                value={filtros.turno}
                onChange={(value) => setFiltros((f) => ({ ...f, turno: value }))}
                options={[
                  { value: "TODOS", label: "Todos los turnos" },
                  ...datos.resumenTurnos.map((t) => ({
                    value: t.nombre,
                    label: t.nombre,
                  })),
                ]}
              />

              <FiltroSelect
                label="Grado"
                value={filtros.grado}
                onChange={(value) => setFiltros((f) => ({ ...f, grado: value }))}
                options={[
                  { value: "TODOS", label: "Todos los grados" },
                  ...grados.map((g) => ({ value: g, label: `${g}°` })),
                ]}
              />

              <FiltroSelect
                label="Sección"
                value={filtros.seccion}
                onChange={(value) => setFiltros((f) => ({ ...f, seccion: value }))}
                options={[
                  { value: "TODAS", label: "Todas las secciones" },
                  ...secciones.map((s) => ({ value: s, label: `Sección ${s}` })),
                ]}
              />

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Última actualización
                </p>
                <p className="mt-2 text-sm font-black text-emerald-300">
                  {fechaHora(datos.actualizadoEn)}
                </p>
              </div>
            </div>
          </header>

          {mensaje && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/40 px-5 py-4 font-bold text-red-200">
              {mensaje}
            </div>
          )}

          {datos.diaNoLectivo && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-amber-200">
              <p className="font-black">📅 Día no lectivo configurado</p>
              <p className="mt-1 text-sm text-amber-100/80">
                Los turnos afectados no generan alertas automáticas.
              </p>
            </div>
          )}

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard title="Estudiantes" value={datos.totalEstudiantes} icon="👨‍🎓" tone="violet" />
            <KpiCard title="Presentes" value={datos.presentes} icon="✅" tone="green" />
            <KpiCard title="Puntuales" value={datos.puntuales} icon="🟢" tone="emerald" />
            <KpiCard title="Sin ingreso" value={datos.sinIngreso} icon="🟡" tone="yellow" />
            <KpiCard title="Tardanza crítica" value={datos.tardanzaSinIngreso} icon="🟠" tone="orange" />
            <KpiCard title="Ausentes" value={datos.ausentesConfirmados} icon="🔴" tone="red" />
          </section>

          {/* CONTROL DE JORNADA ESCOLAR (4 TARJETAS REQUERIDAS) */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">
                Control Completo de Jornada Escolar
              </p>
              <span className="text-xs font-semibold text-slate-500">
                Ciclo: Entrada abierta ➔ Salida cerrada
              </span>
            </div>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Salidas registradas"
                value={datos.salidasRegistradas}
                icon="🚪"
                tone="blue"
              />
              <KpiCard
                title="Pendientes de salida"
                value={datos.pendientesSalida}
                icon="⏳"
                tone="emerald"
              />
              <KpiCard
                title="Jornada completa"
                value={datos.jornadaCompleta}
                icon="🎓"
                tone="indigo"
              />
              <KpiCard
                title="Sin salida"
                value={datos.sinSalida}
                icon="⚠️"
                tone="red"
              />
            </section>
          </div>

          {/* GRÁFICOS DE JORNADA ESCOLAR (2 GRÁFICOS REQUERIDOS) */}
          <section className="mt-4 grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <SectionTitle
                title="Estado actual estudiantes"
                subtitle="Distribución en tiempo real de la jornada escolar"
                badge={`${datos.pendientesSalida} en colegio`}
              />

              <div className="relative mt-3 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graficoEstadoActualEstudiantes}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={75}
                      outerRadius={115}
                      paddingAngle={4}
                      stroke="transparent"
                    >
                      {graficoEstadoActualEstudiantes.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10">
                  <div className="text-center">
                    <p className="text-4xl font-black text-white">
                      {datos.pendientesSalida}
                    </p>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      en colegio
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <SectionTitle
                title="Entrada vs Salida por turno"
                subtitle="Flujo operativo por turno: entradas, salidas, pendientes y sin salida"
                badge="Flujo por turno"
              />
              <div className="mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turnosJornadaGrafico}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="nombre" tick={{ fill: "#94a3b8", fontWeight: 700 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="salidas" name="Salidas" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="pendientes" name="Pendientes salida" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="sinSalida" name="Sin salida" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <SectionTitle
                title="Asistencia general"
                subtitle="Distribución real de la jornada"
                badge={`${porcentajeAsistencia}% asistencia`}
              />

              <div className="relative mt-3 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graficoEstado}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={75}
                      outerRadius={115}
                      paddingAngle={4}
                      stroke="transparent"
                    >
                      {graficoEstado.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10">
                  <div className="text-center">
                    <p className="text-4xl font-black text-white">
                      {porcentajeAsistencia}%
                    </p>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                      asistencia
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <SectionTitle
                title="Comparativo por turnos"
                subtitle="Presentes, pendientes, tardanzas y ausentes"
              />
              <div className="mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turnosGrafico}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="nombre" tick={{ fill: "#94a3b8", fontWeight: 700 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="presentes" name="Presentes" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="sinIngreso" name="Sin ingreso" fill="#eab308" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="tardanzaSinIngreso" name="Tardanza" fill="#f97316" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="ausentesConfirmados" name="Ausentes" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-8`}>
              <SectionTitle
                title="Tendencia de los últimos 7 días"
                subtitle="Presentes, ausentes y tardanzas"
                badge="Actualización automática"
              />
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datos.tendenciaSemanal}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: "#94a3b8", fontWeight: 700 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="presentes" name="Presentes" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ausentes" name="Ausentes" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="tardanzas" name="Tardanzas" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-4`}>
              <SectionTitle
                title="Alertas enviadas"
                subtitle="Telegram a padres y tutores"
                badge={`${datos.alertas.total} mensajes`}
              />
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graficoAlertas}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={100}
                      paddingAngle={5}
                      stroke="transparent"
                    >
                      {graficoAlertas.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <SectionTitle
                title="Secciones con mayor incidencia"
                subtitle="Tardanzas y ausencias confirmadas"
              />
              <div className="mt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSecciones} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="#17312b" strokeDasharray="4 4" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748b" }} />
                    <YAxis
                      type="category"
                      dataKey="etiqueta"
                      width={120}
                      tick={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="tardanzaSinIngreso" name="Tardanza sin ingreso" fill="#f97316" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="ausentesConfirmados" name="Ausentes" fill="#f43f5e" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <SectionTitle
                title="Estado del motor automático"
                subtitle="Control de cron y procesamiento"
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MiniStatus label="Motor" value={datos.automatizaciones.activas ? "ACTIVO" : "APAGADO"} tone={datos.automatizaciones.activas ? "green" : "red"} />
                <MiniStatus label="Modo" value={datos.automatizaciones.modoPrueba ? "PRUEBA" : "PADRES"} tone="blue" />
                <MiniStatus label="Frecuencia" value={`${datos.automatizaciones.frecuenciaMinutos} min`} tone="violet" />
                <MiniStatus label="Última ejecución" value={fechaHora(datos.automatizaciones.ultimaEjecucion)} tone="slate" />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Resultado más reciente
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                  {datos.automatizaciones.ultimoEstado || "Sin información todavía."}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-7`}>
              <SectionTitle
                title="Actividad reciente de alertas"
                subtitle="Últimos estudiantes notificados"
              />
              <div className="mt-4 max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {datos.ultimasAlertas.map((alerta) => (
                  <ActividadAlerta key={alerta.id} alerta={alerta} hora={hora} />
                ))}
                {datos.ultimasAlertas.length === 0 && <Vacio texto="Todavía no se enviaron alertas hoy." />}
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-5`}>
              <SectionTitle
                title="Últimas asistencias"
                subtitle="Entradas y salidas registradas"
              />
              <div className="mt-4 max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {datos.ultimasAsistencias.map((asistencia) => (
                  <ActividadAsistencia key={asistencia.id} asistencia={asistencia} hora={hora} />
                ))}
                {datos.ultimasAsistencias.length === 0 && <Vacio texto="Aún no hay asistencias registradas hoy." />}
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-3">
            {turnosFiltrados.map((turno) => (
              <TurnoCard key={turno.id} turno={turno} />
            ))}
          </section>
          <section className="mt-4 grid gap-4 xl:grid-cols-12">
            <div className={`${PANEL} p-5 xl:col-span-8`}>
              <SectionTitle
                title="Rendimiento dinámico por grado"
                subtitle="Se genera automáticamente desde todos los grados y secciones activos"
                badge={`${gradosGrafico.length} grados`}
              />

              <div className="mt-4 h-[330px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={gradosGrafico}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      stroke="#17312b"
                      strokeDasharray="4 4"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="etiqueta"
                      tick={{
                        fill: "#cbd5e1",
                        fontWeight: 800,
                      }}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fill: "#64748b",
                      }}
                    />

                    <Tooltip
                      content={
                        <CustomTooltip />
                      }
                    />

                    <Legend />

                    <Bar
                      dataKey="presentes"
                      name="Presentes"
                      fill="#22c55e"
                      radius={[
                        8,
                        8,
                        0,
                        0,
                      ]}
                    />

                    <Bar
                      dataKey="sinIngreso"
                      name="Sin ingreso"
                      fill="#eab308"
                      radius={[
                        8,
                        8,
                        0,
                        0,
                      ]}
                    />

                    <Bar
                      dataKey="ausentesConfirmados"
                      name="Ausentes"
                      fill="#f43f5e"
                      radius={[
                        8,
                        8,
                        0,
                        0,
                      ]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${PANEL} p-5 xl:col-span-4`}>
              <SectionTitle
                title="Cobertura académica"
                subtitle="Estructura detectada automáticamente"
                badge={`${seccionesFiltradas.length} secciones visibles`}
              />

              <div className="mt-5 space-y-3">
                <CoberturaDato
                  icono="🎓"
                  titulo="Grados detectados"
                  valor={grados.length}
                  detalle={
                    grados.length > 0
                      ? grados
                          .map(
                            (grado) =>
                              `${grado}°`
                          )
                          .join(", ")
                      : "Sin grados registrados"
                  }
                />

                <CoberturaDato
                  icono="🏫"
                  titulo="Secciones detectadas"
                  valor={secciones.length}
                  detalle={
                    secciones.length > 0
                      ? secciones.join(
                          ", "
                        )
                      : "Sin secciones registradas"
                  }
                />

                <CoberturaDato
                  icono="⏰"
                  titulo="Turnos activos"
                  valor={
                    datos.resumenTurnos
                      .filter(
                        (turno) =>
                          turno.activo
                      ).length
                  }
                  detalle={datos.resumenTurnos
                    .map(
                      (turno) =>
                        turno.nombre
                    )
                    .join(", ") || "Sin turnos"}
                />
              </div>
            </div>
          </section>

<section className="mt-4">
  <div className={`${PANEL} p-5`}>
    <SectionTitle
      title="Mapa inteligente por grado y sección"
      subtitle="Lectura visual de asistencia, incidencias y alertas"
      badge={`${seccionesFiltradas.length} secciones`}
    />

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {seccionesFiltradas.map((item) => {
        const presentes = numero(item.presentes);
        const total = numero(item.total);

        const tardanzas =
          numero(item.tardanzas) +
          numero(item.tardanzaSinIngreso);

        const ausentes = numero(
          item.ausentesConfirmados
        );

        const porcentaje =
          total > 0
            ? Math.round(
                (presentes / total) * 100
              )
            : 0;

        const incidencias =
          tardanzas + ausentes;

        const nivel =
          ausentes > 0
            ? "Crítico"
            : tardanzas > 0
              ? "Atención"
              : presentes > 0
                ? "Estable"
                : "Sin actividad";

        return (
          <div
            key={`${item.turno}-${item.grado}-${item.seccion}`}
            className="group rounded-3xl border border-slate-800 bg-gradient-to-br from-[#07111f] to-[#03100d] p-4 transition hover:-translate-y-1 hover:border-emerald-500/35"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  {item.turno}
                </p>

                <h3 className="mt-1 text-xl font-black text-white">
                  {item.grado}° · Sección{" "}
                  {item.seccion}
                </h3>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {total} estudiantes ·{" "}
                  {numero(
                    item.alertasEnviadas
                  )}{" "}
                  alertas
                </p>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                  nivel === "Crítico"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : nivel === "Atención"
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                      : nivel === "Estable"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700 bg-slate-800/50 text-slate-400"
                }`}
              >
                {nivel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[92px_1fr] items-center gap-4">
              <div className="relative h-[92px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <RadialBarChart
                    innerRadius="72%"
                    outerRadius="100%"
                    data={[
                      {
                        value: porcentaje,
                        fill:
                          porcentaje >= 80
                            ? "#22c55e"
                            : porcentaje >= 50
                              ? "#eab308"
                              : "#f43f5e",
                      },
                    ]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      dataKey="value"
                      background={{
                        fill: "#132238",
                      }}
                      cornerRadius={10}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-white">
                    {porcentaje}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <BarraEstado
                  label="Presentes"
                  value={presentes}
                  total={total}
                  tone="green"
                />

                <BarraEstado
                  label="Tardanzas"
                  value={tardanzas}
                  total={total}
                  tone="orange"
                />

                <BarraEstado
                  label="Ausentes"
                  value={ausentes}
                  total={total}
                  tone="red"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniKpi
                label="Puntuales"
                value={numero(
                  item.puntuales
                )}
                tone="green"
              />

              <MiniKpi
                label="Incidencias"
                value={incidencias}
                tone="orange"
              />

              <MiniKpi
                label="Alertas"
                value={numero(
                  item.alertasEnviadas
                )}
                tone="violet"
              />
            </div>
          </div>
        );
      })}

      {seccionesFiltradas.length ===
        0 && (
        <div className="col-span-full">
          <Vacio texto="No hay secciones para los filtros seleccionados." />
        </div>
      )}
    </div>
  </div>
</section>
          
          <footer className="py-6 text-center text-xs font-semibold text-slate-600">
            Última sincronización: {fechaHora(datos.actualizadoEn)} · Datos reales de Neon + Automatizaciones + Telegram
          </footer>
        </div>

        {cargando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="rounded-3xl border border-emerald-500/30 bg-[#07111f] px-8 py-6 text-center shadow-2xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
              <p className="mt-4 font-black text-white">Cargando monitoreo...</p>
            </div>
          </div>
        )}
      </main>
    </ProteccionRol>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm font-black text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EstadoChip({
  activo,
  textoActivo,
  textoInactivo,
}: {
  activo: boolean;
  textoActivo: string;
  textoInactivo: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black ${
        activo
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${activo ? "bg-emerald-400" : "bg-red-400"}`} />
      {activo ? textoActivo : textoInactivo}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: string;
  tone: "violet" | "green" | "emerald" | "yellow" | "orange" | "red" | "blue" | "indigo" | "cyan";
}) {
  const tones = {
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    green: "border-green-500/30 bg-green-500/10 text-green-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    red: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-xl ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider opacity-75">{title}</p>
          <p className="mt-3 text-4xl font-black tabular-nums text-white">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      {badge && (
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
          {badge}
        </span>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-700 bg-[#020806]/95 p-3 text-xs shadow-2xl">
      {label && <p className="mb-2 font-black text-white">{label}</p>}
      {payload.map((item: any) => (
        <div key={`${item.name}-${item.value}`} className="flex items-center justify-between gap-5 py-0.5">
          <span className="font-semibold" style={{ color: item.color }}>
            {item.name}
          </span>
          <span className="font-black text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function MiniStatus({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "blue" | "violet" | "slate";
}) {
  const tones = {
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/25 bg-red-500/10 text-red-300",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    slate: "border-slate-700 bg-slate-900/70 text-slate-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-2 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function ActividadAlerta({
  alerta,
  hora,
}: {
  alerta: AlertaReciente;
  hora: (fecha: string | null | undefined) => string;
}) {
  const icono =
    alerta.tipo === "INGRESO_PENDIENTE"
      ? "🟡"
      : alerta.tipo === "AUSENCIA_CONFIRMADA"
        ? "🔴"
        : "🟠";

  const nombre =
    alerta.tipo === "INGRESO_PENDIENTE"
      ? "Aviso de ingreso pendiente"
      : alerta.tipo === "AUSENCIA_CONFIRMADA"
        ? "Ausencia confirmada"
        : "Alerta de tardanza";

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/55 p-4 hover:border-emerald-500/30">
      <div className="flex min-w-0 gap-3">
        <span className="text-xl">{icono}</span>
        <div className="min-w-0">
          <p className="truncate font-black text-white">
            {alerta.estudiante.nombres} {alerta.estudiante.apellidos}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {alerta.estudiante.grado}° {alerta.estudiante.seccion} · {alerta.estudiante.turno?.nombre || "Sin turno"}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">
            {nombre}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-xs font-black text-slate-300">{hora(alerta.createdAt)}</p>
    </div>
  );
}

function ActividadAsistencia({
  asistencia,
  hora,
}: {
  asistencia: Asistencia;
  hora: (fecha: string | null | undefined) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/55 p-4 hover:border-blue-500/30">
      <div>
        <p className="font-black text-white">
          {asistencia.estudiante.nombres} {asistencia.estudiante.apellidos}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {asistencia.estudiante.grado}° {asistencia.estudiante.seccion} · {asistencia.estudiante.turno?.nombre || "Sin turno"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge estado={asistencia.estado} />
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black text-blue-300">
            {asistencia.metodo}
          </span>
        </div>
      </div>
      <p className="shrink-0 text-xs font-black text-slate-300">
        {hora(asistencia.horaSalida || asistencia.horaEntrada)}
      </p>
    </div>
  );
}

function Badge({ estado }: { estado: string }) {
  const tarde = estado.toUpperCase() === "TARDE";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
        tarde
          ? "border-orange-500/20 bg-orange-500/10 text-orange-300"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      }`}
    >
      {estado}
    </span>
  );
}

function TurnoCard({ turno }: { turno: TurnoResumen }) {
  const sinIngreso =
    turno.esperandoIngreso +
    turno.ingresoPendiente +
    turno.tardanzaSinIngreso;

  const porcentaje =
    turno.total > 0
      ? Math.round((turno.presentes / turno.total) * 100)
      : 0;

  const radial = [
    {
      name: "Asistencia",
      value: porcentaje,
      fill: porcentaje >= 80 ? "#22c55e" : porcentaje >= 50 ? "#eab308" : "#f43f5e",
    },
  ];

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
            Monitoreo por turno
          </p>
          <h3 className="mt-1 text-xl font-black text-white">⏰ {turno.nombre}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {turno.horaEntrada} - {turno.horaSalida}
          </p>
        </div>
        <EstadoChip
          activo={turno.activo && !turno.noLectivo}
          textoActivo="Activo"
          textoInactivo={turno.noLectivo ? "No lectivo" : "Inactivo"}
        />
      </div>

      <div className="mt-4 grid grid-cols-[130px_1fr] items-center gap-4">
        <div className="relative h-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={radial}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar dataKey="value" background={{ fill: "#132238" }} cornerRadius={12} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">{porcentaje}%</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">asistencia</span>
          </div>
        </div>

        <div className="space-y-2">
          <BarraEstado label="Presentes" value={turno.presentes} total={turno.total} tone="green" />
          <BarraEstado label="Sin ingreso" value={sinIngreso} total={turno.total} tone="yellow" />
          <BarraEstado label="Ausentes" value={turno.ausentesConfirmados} total={turno.total} tone="red" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniKpi label="Total" value={turno.total} tone="slate" />
        <MiniKpi label="Puntuales" value={turno.puntuales} tone="green" />
        <MiniKpi label="Tardanzas" value={turno.tardanzas + turno.tardanzaSinIngreso} tone="orange" />
        <MiniKpi label="Alertas" value={turno.alertasEnviadas} tone="violet" />
      </div>
    </div>
  );
}





function BarraEstado({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "green" | "yellow" | "orange" | "red";
}) {
  const porcentaje = total > 0 ? Math.min(Math.round((value / total) * 100), 100) : 0;
  const colores = {
    green: "bg-emerald-400",
    yellow: "bg-yellow-400",
    orange: "bg-orange-400",
    red: "bg-rose-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-200">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-700 ${colores[tone]}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "slate" | "green" | "orange" | "red" | "violet";
}) {
  const colores = {
    slate: "text-slate-200",
    green: "text-emerald-300",
    orange: "text-orange-300",
    red: "text-rose-300",
    violet: "text-violet-300",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-3 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${colores[tone]}`}>{value}</p>
    </div>
  );
}

function RecomendacionIA({
  icono,
  titulo,
  descripcion,
  tone,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  tone: "green" | "orange" | "red" | "violet";
}) {
  const tonos = {
    green: "border-emerald-500/20 bg-emerald-500/5",
    orange: "border-orange-500/20 bg-orange-500/5",
    red: "border-rose-500/20 bg-rose-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
  };

  return (
    <div className={`rounded-2xl border p-3 ${tonos[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icono}</span>
        <div>
          <p className="text-sm font-black text-white">{titulo}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{descripcion}</p>
        </div>
      </div>
    </div>
  );
}

function CoberturaDato({
  icono,
  titulo,
  valor,
  detalle,
}: {
  icono: string;
  titulo: string;
  valor: number;
  detalle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
          {icono}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            {titulo}
          </p>

          <p className="mt-1 text-2xl font-black text-white">
            {valor}
          </p>

          <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-400">
            {detalle}
          </p>
        </div>
      </div>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 py-10 text-center text-sm font-semibold text-slate-500">
      {texto}
    </div>
  );
}