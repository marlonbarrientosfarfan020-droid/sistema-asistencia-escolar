"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

type EstadoSuperMotor = {
  motorActivo: boolean;
  estadoJornada: string;
  asistenciaActivo: boolean;
  telegramActivo: boolean;
  whatsappActivo: boolean;
  reportesActivo: boolean;
  portalActivo: boolean;
  iaActivo: boolean;
  alertasActivo: boolean;
  fotosActivo: boolean;
  modoOperacion?: "MANUAL" | "AUTOMATICO";
  horaAperturaJornada?: string | null;
  horaCierreJornada?: string | null;
  minutosAnticipacionEntrada?: number | null;
  minutosCierreAutomatico?: number | null;
  evaluacionJornada?: {
    modo: string;
    estado: string;
    motivo: string;
    proximaApertura?: string;
    proximoCierre?: string;
    horaPeru: string;
    fechaPeru: string;
    turno?: string;
  } | null;
  ultimaActivacion: string | null;
  ultimoUsuario: string | null;
  updatedAt: string | null;
};

type ModuloDef = {
  id: keyof Pick<
    EstadoSuperMotor,
    | "asistenciaActivo"
    | "fotosActivo"
    | "portalActivo"
    | "telegramActivo"
    | "whatsappActivo"
    | "reportesActivo"
    | "iaActivo"
    | "alertasActivo"
  >;
  nombreApi: string;
  titulo: string;
  descripcion: string;
  icono: string;
  colorActivo: string;
};

const MODULOS: ModuloDef[] = [
  {
    id: "asistenciaActivo",
    nombreApi: "asistencia",
    titulo: "ASISTENCIA",
    descripcion: "Control QR, DNI y reconocimiento facial.",
    icono: "🎓",
    colorActivo: "border-blue-500/40 bg-blue-50/70 text-blue-900",
  },
  {
    id: "fotosActivo",
    nombreApi: "fotos",
    titulo: "FOTOS EVIDENCIA",
    descripcion: "Captura y almacenamiento de evidencias.",
    icono: "📸",
    colorActivo: "border-purple-500/40 bg-purple-50/70 text-purple-900",
  },
  {
    id: "portalActivo",
    nombreApi: "portal",
    titulo: "PORTAL PADRES",
    descripcion: "Consulta familiar de asistencia.",
    icono: "👨‍👩‍👧",
    colorActivo: "border-emerald-500/40 bg-emerald-50/70 text-emerald-900",
  },
  {
    id: "telegramActivo",
    nombreApi: "telegram",
    titulo: "TELEGRAM",
    descripcion: "Notificaciones automáticas.",
    icono: "✈️",
    colorActivo: "border-sky-500/40 bg-sky-50/70 text-sky-900",
  },
  {
    id: "whatsappActivo",
    nombreApi: "whatsapp",
    titulo: "WHATSAPP",
    descripcion: "Mensajería institucional.",
    icono: "💬",
    colorActivo: "border-green-500/40 bg-green-50/70 text-green-900",
  },
  {
    id: "reportesActivo",
    nombreApi: "reportes",
    titulo: "REPORTES",
    descripcion: "Reportes diarios, semanales y mensuales.",
    icono: "📊",
    colorActivo: "border-amber-500/40 bg-amber-50/70 text-amber-900",
  },
  {
    id: "iaActivo",
    nombreApi: "ia",
    titulo: "INTELIGENCIA ARTIFICIAL",
    descripcion: "Análisis y predicciones.",
    icono: "🤖",
    colorActivo: "border-indigo-500/40 bg-indigo-50/70 text-indigo-900",
  },
  {
    id: "alertasActivo",
    nombreApi: "alertas",
    titulo: "ALERTAS",
    descripcion: "Ausencias y tardanzas.",
    icono: "🔔",
    colorActivo: "border-rose-500/40 bg-rose-50/70 text-rose-900",
  },
];

export default function SuperMotorDashboardPage() {
  const { configuracion } = useConfiguracionColegio();

  // Estados de datos
  const [estado, setEstado] = useState<EstadoSuperMotor>({
    motorActivo: false,
    estadoJornada: "CERRADO",
    asistenciaActivo: false,
    telegramActivo: false,
    whatsappActivo: false,
    reportesActivo: false,
    portalActivo: false,
    iaActivo: false,
    alertasActivo: false,
    fotosActivo: false,
    modoOperacion: "MANUAL",
    horaAperturaJornada: "06:30",
    horaCierreJornada: "14:30",
    evaluacionJornada: null,
    ultimaActivacion: null,
    ultimoUsuario: null,
    updatedAt: null,
  });

  const [cargando, setCargando] = useState(true);
  const [guardandoMotor, setGuardandoMotor] = useState(false);
  const [guardandoModo, setGuardandoModo] = useState(false);
  const [moduloActualizandose, setModuloActualizandose] = useState<string | null>(null);

  // Sesión y permisos
  const [rolUsuario, setRolUsuario] = useState<string>("");
  const [nombreUsuario, setNombreUsuario] = useState<string>("");

  const puedeModificar =
    rolUsuario === "ADMIN" ||
    rolUsuario === "DIRECTOR" ||
    rolUsuario === "DIRECTIVO";

  // Reloj en tiempo real hora Perú
  const [horaPeru, setHoraPeru] = useState<string>("");
  const [fechaPeru, setFechaPeru] = useState<string>("");

  // Modal de confirmación para el motor principal
  const [modalConfirmacion, setModalConfirmacion] = useState<{
    abierto: boolean;
    accion: "encender" | "apagar";
  }>({
    abierto: false,
    accion: "encender",
  });

  // Mensajes de feedback (Toast o Banner)
  const [mensajeToast, setMensajeToast] = useState<{
    texto: string;
    tipo: "exito" | "error" | "info";
  } | null>(null);

  const timeoutMensajeRef = useRef<NodeJS.Timeout | null>(null);

  const mostrarMensaje = useCallback(
    (texto: string, tipo: "exito" | "error" | "info" = "info") => {
      if (timeoutMensajeRef.current) {
        clearTimeout(timeoutMensajeRef.current);
      }
      setMensajeToast({ texto, tipo });
      timeoutMensajeRef.current = setTimeout(() => {
        setMensajeToast(null);
      }, 5000);
    },
    []
  );

  // Reloj dinámico de Perú (America/Lima)
  useEffect(() => {
    function actualizarReloj() {
      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString("es-PE", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const fechaStr = ahora.toLocaleDateString("es-PE", {
        timeZone: "America/Lima",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      setHoraPeru(horaStr);
      setFechaPeru(fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1));
    }

    actualizarReloj();
    const interval = setInterval(actualizarReloj, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar rol y usuario
  useEffect(() => {
    const rolGuardado = localStorage.getItem("rol") || "";
    const usuarioGuardado = localStorage.getItem("usuario") || "";
    setRolUsuario(rolGuardado);
    setNombreUsuario(usuarioGuardado);

    // Verificar adicionalmente contra endpoint de sesión para máxima seguridad
    fetch("/api/auth/sesion", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.autenticado && data?.usuario) {
          setRolUsuario(data.usuario.rol || "");
          setNombreUsuario(data.usuario.nombre || "");
        }
      })
      .catch((err) => {
        console.warn("No se pudo verificar sesión con API:", err);
      });
  }, []);

  // Consultar estado actual del SuperMotor
  const cargarEstado = useCallback(async () => {
    try {
      const res = await fetch("/api/supermotor", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Error al consultar estado");
      }

      const data: EstadoSuperMotor = await res.json();
      setEstado(data);
    } catch (error: any) {
      console.error("Error al cargar estado del SuperMotor:", error);
      mostrarMensaje(
        `Error al cargar el SuperMotor: ${error?.message || "Servidor no disponible"}`,
        "error"
      );
    } finally {
      setCargando(false);
    }
  }, [mostrarMensaje]);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado]);

  // FASE 6.6: Escuchar cambios del SuperMotor en tiempo real (SSE)
  const handleSuperMotorRealtime = useCallback((evento: any) => {
    if (evento?.estado) {
      setEstado(evento.estado);
    } else {
      void cargarEstado();
    }
  }, [cargarEstado]);

  const { conectado: sseConectado } = useRealtimeEvents({
    onSuperMotor: handleSuperMotorRealtime,
  });

  // FASE 7.1 & 7.9: Cambiar modo de operación (Manual vs Automático)
  async function cambiarModoOperacion(nuevoModo: "MANUAL" | "AUTOMATICO") {
    if (!puedeModificar) {
      mostrarMensaje(
        "Acción denegada: Solo administradores y directores pueden cambiar el modo de operación.",
        "error"
      );
      return;
    }

    setGuardandoModo(true);
    try {
      const res = await fetch("/api/supermotor", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modoOperacion: nuevoModo,
          usuario: nombreUsuario || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al cambiar el modo de operación");
      }

      mostrarMensaje(
        `Modo de operación cambiado a: ${nuevoModo === "AUTOMATICO" ? "AUTOMÁTICO 🤖" : "MANUAL 🔘"}`,
        "exito"
      );
      await cargarEstado();
    } catch (error: any) {
      mostrarMensaje(`Error al cambiar modo: ${error.message}`, "error");
    } finally {
      setGuardandoModo(false);
    }
  }

  // Modificar motor principal (Encender / Apagar)
  async function cambiarMotorPrincipal(nuevoEstado: boolean) {
    if (!puedeModificar) {
      mostrarMensaje(
        "Acción denegada: Solo administradores y directores pueden cambiar el estado.",
        "error"
      );
      return;
    }

    setGuardandoMotor(true);
    setModalConfirmacion({ abierto: false, accion: "encender" });

    try {
      const res = await fetch("/api/supermotor", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modulo: "motor",
          activo: nuevoEstado,
          usuario: nombreUsuario || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Error al actualizar configuración");
      }

      mostrarMensaje(
        nuevoEstado
          ? "🟢 SuperMotor ESCOLAR ENCENDIDO correctamente"
          : "🔴 SuperMotor ESCOLAR APAGADO correctamente",
        "exito"
      );

      if (data.estado) {
        setEstado(data.estado);
      } else {
        await cargarEstado();
      }
    } catch (error: any) {
      console.error("Error al cambiar estado del motor:", error);
      mostrarMensaje(
        `Error al actualizar configuración: ${error?.message || "Falla de red"}`,
        "error"
      );
      // Evitar estados falsos: recargar desde el servidor
      await cargarEstado();
    } finally {
      setGuardandoMotor(false);
    }
  }

  // Modificar submódulo individual
  async function cambiarModulo(nombreApi: string, nuevoEstado: boolean) {
    if (!puedeModificar) {
      mostrarMensaje(
        "Acción denegada: Solo administradores y directores pueden modificar módulos.",
        "error"
      );
      return;
    }

    setModuloActualizandose(nombreApi);

    try {
      const res = await fetch("/api/supermotor", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modulo: nombreApi,
          activo: nuevoEstado,
          usuario: nombreUsuario || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Error al actualizar configuración");
      }

      // Nombre legible para el toast
      const moduloInfo = MODULOS.find((m) => m.nombreApi === nombreApi);
      const nombreVisible = moduloInfo ? moduloInfo.titulo : nombreApi.toUpperCase();

      mostrarMensaje(
        `${nombreVisible} ${nuevoEstado ? "activado" : "desactivado"} correctamente`,
        "exito"
      );

      if (data.estado) {
        setEstado(data.estado);
      } else {
        await cargarEstado();
      }
    } catch (error: any) {
      console.error(`Error al cambiar módulo ${nombreApi}:`, error);
      mostrarMensaje(
        `Error al actualizar configuración: ${error?.message || "Falla de comunicación"}`,
        "error"
      );
      // Evitar estados visuales falsos: recargar inmediatamente desde el servidor
      await cargarEstado();
    } finally {
      setModuloActualizandose(null);
    }
  }

  // Formato de fecha y hora para última activación
  function formatearFechaHoraPer(fechaIso: string | null) {
    if (!fechaIso) return "Sin registros de activación";
    try {
      const d = new Date(fechaIso);
      return d.toLocaleString("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "medium",
        timeStyle: "medium",
      });
    } catch {
      return fechaIso;
    }
  }

  return (
    <main className="min-h-screen space-y-6 bg-slate-100 p-4 sm:p-6 md:p-8">
      {/* BANNER FLOTANTE DE MENSAJE (TOAST) */}
      {mensajeToast && (
        <aside
          aria-live="polite"
          className={`fixed right-4 top-20 z-50 flex max-w-md items-center gap-3 rounded-2xl border px-5 py-4 font-bold shadow-2xl backdrop-blur-lg transition-all animate-in fade-in slide-in-from-top-4 ${
            mensajeToast.tipo === "exito"
              ? "border-emerald-300 bg-emerald-600 text-white shadow-emerald-950/20"
              : mensajeToast.tipo === "error"
              ? "border-red-300 bg-red-600 text-white shadow-red-950/20"
              : "border-blue-300 bg-slate-900 text-white shadow-slate-950/30"
          }`}
        >
          <span className="text-xl">
            {mensajeToast.tipo === "exito"
              ? "✅"
              : mensajeToast.tipo === "error"
              ? "❌"
              : "ℹ️"}
          </span>
          <p className="flex-1 text-sm">{mensajeToast.texto}</p>
          <button
            type="button"
            onClick={() => setMensajeToast(null)}
            className="rounded-lg bg-white/20 px-2 py-1 text-xs font-black transition hover:bg-white/30"
          >
            ✕
          </button>
        </aside>
      )}

      {/* CABECERA HERO PRINCIPAL */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-300">
                Centro de Control Maestro
              </span>
              <span className="rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-200">
                Versión 1.0
              </span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              ⚡ SUPERMOTOR ESCOLAR INTELIGENTE
            </h1>

            <p className="mt-2 max-w-3xl text-sm sm:text-base text-slate-300">
              Capa de control administrativo central para la activación, supervisión
              y orquestación de todos los módulos del ecosistema educativo.
            </p>
          </div>

          {/* INDICADORES HERO */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center gap-3 rounded-2xl border px-5 py-3 backdrop-blur-md shadow-lg transition ${
                estado.motorActivo
                  ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                  : "border-rose-400/40 bg-rose-500/20 text-rose-100"
              }`}
            >
              <span
                className={`relative flex h-4 w-4 shrink-0 rounded-full ${
                  estado.motorActivo ? "bg-emerald-400" : "bg-rose-500"
                }`}
              >
                {estado.motorActivo && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">
                  Estado Central
                </p>
                <p className="text-sm font-black">
                  {estado.motorActivo ? "OPERATIVO" : "DETENIDO"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Jornada
              </p>
              <p className="text-sm font-black text-white">
                {estado.estadoJornada === "ABIERTO" ? "🌅 ABIERTO" : "🌙 CERRADO"}
              </p>
            </div>

            {sseConectado && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-3 backdrop-blur-md shadow-lg text-emerald-200">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-xs font-black uppercase tracking-wider">⚡ SSE EN VIVO</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AVISO DE SEGURIDAD / MODO SOLO LECTURA */}
      {!puedeModificar && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-black text-sm">Modo de Consulta (Solo Lectura)</p>
              <p className="text-xs text-amber-800">
                Has ingresado con el rol <strong>{rolUsuario || "USUARIO"}</strong>. Solo los usuarios con rol{" "}
                <strong>ADMIN</strong> o <strong>DIRECTOR</strong> tienen privilegios para encender o apagar el motor y sus módulos.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* FASE 7.9: MODO DE OPERACIÓN Y JORNADA AUTOMÁTICA */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-md">
                ⚙️
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
                  Motor de Jornada
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  MODO DE OPERACIÓN ESCOLAR
                </h2>
              </div>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-500">
              Elija si la activación y cierre del SuperMotor se realiza manualmente o de forma automática según el calendario y turnos.
            </p>
          </div>

          {/* SELECTOR INTERACTIVO MANUAL VS AUTOMÁTICO */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              type="button"
              disabled={!puedeModificar || guardandoModo}
              onClick={() => cambiarModoOperacion("MANUAL")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
                estado.modoOperacion !== "AUTOMATICO"
                  ? "bg-white text-slate-950 shadow-md ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🔘</span>
              <span>Modo Manual</span>
            </button>

            <button
              type="button"
              disabled={!puedeModificar || guardandoModo}
              onClick={() => cambiarModoOperacion("AUTOMATICO")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
                estado.modoOperacion === "AUTOMATICO"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🤖</span>
              <span>Modo Automático</span>
            </button>
          </div>
        </div>

        {/* INDICADORES DEL MODO DE OPERACIÓN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Modo Activo
            </p>
            <p className="mt-2 text-base font-black text-slate-900 flex items-center gap-2">
              <span>{estado.modoOperacion === "AUTOMATICO" ? "🤖 AUTOMÁTICO" : "🔘 MANUAL"}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {estado.modoOperacion === "AUTOMATICO"
                ? "El sistema gestiona el horario según turnos y calendario."
                : "El director controla el botón de Encender/Apagar."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              🌅 Próxima Apertura
            </p>
            <p className="mt-2 text-lg font-black text-emerald-700">
              {estado.modoOperacion === "AUTOMATICO"
                ? (estado.evaluacionJornada?.proximaApertura || estado.horaAperturaJornada || "06:30")
                : "Control Manual"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {estado.modoOperacion === "AUTOMATICO"
                ? "Apertura anticipada de preparación"
                : "La dirección decide la apertura"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              🌙 Próximo Cierre
            </p>
            <p className="mt-2 text-lg font-black text-rose-700">
              {estado.modoOperacion === "AUTOMATICO"
                ? (estado.evaluacionJornada?.proximoCierre || estado.horaCierreJornada || "14:30")
                : "Control Manual"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {estado.modoOperacion === "AUTOMATICO"
                ? "Cierre automático post-salida"
                : "La dirección decide el cierre"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Estado de la Jornada
            </p>
            <p className="mt-2 text-sm font-black flex items-center gap-1.5">
              {estado.evaluacionJornada?.estado === "OPERATIVO" && (
                <span className="text-emerald-700">🟢 Operativo</span>
              )}
              {estado.evaluacionJornada?.estado === "PREPARANDO" && (
                <span className="text-amber-700">🟡 Preparando jornada</span>
              )}
              {estado.evaluacionJornada?.estado === "FINALIZANDO" && (
                <span className="text-orange-700">🟠 Finalizando jornada</span>
              )}
              {(!estado.evaluacionJornada?.estado || estado.evaluacionJornada?.estado === "CERRADO") && (
                <span className="text-slate-600">🔴 Cerrado</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 truncate" title={estado.evaluacionJornada?.motivo || ""}>
              {estado.evaluacionJornada?.motivo || "Sin evaluación activa"}
            </p>
          </div>
        </div>
      </section>

      {/* 1. TARJETA PRINCIPAL DEL SUPERMOTOR */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm transition">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white shadow-md">
                🚀
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Motor Principal
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  SUPERMOTOR ESCOLAR INTELIGENTE
                </h2>
              </div>
            </div>
          </div>

          {/* ESTADO ACTUAL BADGE */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-3 rounded-2xl border px-6 py-3 font-black text-base transition ${
                estado.motorActivo
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-red-300 bg-red-50 text-red-800"
              }`}
            >
              <span className="text-2xl">
                {estado.motorActivo ? "🟢" : "🔴"}
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Estado Actual
                </p>
                <p className="text-lg font-black leading-tight">
                  {estado.motorActivo ? "OPERATIVO" : "DETENIDO"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* INFORMACIÓN INSTITUCIONAL Y HORARIA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 py-6 border-b border-slate-100">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              🏫 Colegio Actual
            </p>
            <p className="mt-2 text-sm font-black text-slate-900 truncate">
              {configuracion.nombreColegio || "Santa Rita de Casia"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              📅 Fecha Actual
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900">
              {fechaPeru || "Cargando..."}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">
              ⏱️ Hora Perú (En Vivo)
            </p>
            <p className="mt-2 text-base font-black text-blue-900 font-mono">
              {horaPeru || "--:--:--"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              🕒 Última Activación
            </p>
            <p className="mt-2 text-xs font-bold text-slate-800">
              {formatearFechaHoraPer(estado.ultimaActivacion)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              👤 Usuario Responsable
            </p>
            <p className="mt-2 text-sm font-black text-slate-900 truncate">
              {estado.ultimoUsuario || "Sistema"}
            </p>
          </div>
        </div>

        {/* BOTONES DE CONTROL MAESTRO */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {puedeModificar ? (
              <span>
                💡 Al encender o apagar el sistema se notificará y registrará en la auditoría general.
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">
                ⚠️ Botones de control deshabilitados en modo de solo lectura.
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* BOTÓN ENCENDER SISTEMA */}
            <button
              type="button"
              id="btn-encender-supermotor"
              disabled={
                !puedeModificar ||
                cargando ||
                guardandoMotor ||
                estado.motorActivo
              }
              onClick={() =>
                setModalConfirmacion({ abierto: true, accion: "encender" })
              }
              className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black shadow-md transition ${
                estado.motorActivo
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  : !puedeModificar
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-600/30"
              }`}
            >
              <span className="text-base">🟢</span>
              <span>ENCENDER SISTEMA</span>
            </button>

            {/* BOTÓN APAGAR SISTEMA */}
            <button
              type="button"
              id="btn-apagar-supermotor"
              disabled={
                !puedeModificar ||
                cargando ||
                guardandoMotor ||
                !estado.motorActivo
              }
              onClick={() =>
                setModalConfirmacion({ abierto: true, accion: "apagar" })
              }
              className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black shadow-md transition ${
                !estado.motorActivo
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  : !puedeModificar
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  : "bg-rose-600 text-white hover:bg-rose-700 active:scale-95 shadow-rose-600/30"
              }`}
            >
              <span className="text-base">🔴</span>
              <span>APAGAR SISTEMA</span>
            </button>

            {/* BOTÓN RECARGAR */}
            <button
              type="button"
              onClick={() => void cargarEstado()}
              disabled={cargando}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-slate-50 transition"
              title="Sincronizar con el servidor"
            >
              <span className={cargando ? "animate-spin" : ""}>🔄</span>
              <span>Refrescar</span>
            </button>
          </div>
        </div>
      </section>

      {/* GUÍA OPERATIVA INSTITUCIONAL */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5 text-blue-950 shadow-sm">
        <h4 className="font-black text-xs uppercase tracking-wider text-blue-900 flex items-center gap-2">
          <span>ℹ️</span>
          <span>ARQUITECTURA OPERATIVA DEL COLEGIO: DIFERENCIA DE INDICADORES</span>
        </h4>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <p className="font-black text-slate-900">1. Servicio Central</p>
            <p className="text-slate-600 mt-1">Indica si el motor y los daemons de sincronización están encendidos en el servidor.</p>
          </div>
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <p className="font-black text-slate-900">2. Jornada Escolar</p>
            <p className="text-slate-600 mt-1">Indica si la ventana de registro de asistencia está actualmente <strong>ABIERTA</strong> o <strong>CERRADA</strong>.</p>
          </div>
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <p className="font-black text-slate-900">3. Modo de Operación</p>
            <p className="text-slate-600 mt-1">En <strong>MANUAL</strong>, la Dirección abre y cierra la jornada. En <strong>AUTOMÁTICO</strong>, el sistema sigue el calendario y turnos.</p>
          </div>
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <p className="font-black text-slate-900">4. Cron Jobs Independientes</p>
            <p className="text-slate-600 mt-1">Ejecutan barridos de asistencia sin salida e informes. En modo manual, no alteran el interruptor del motor.</p>
          </div>
        </div>
      </section>

      {/* 2. CONTROL DE MÓDULOS INDEPENDIENTES */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              🎛️ Control de Módulos Independientes
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Active o desactive los subsistemas de forma individual según el protocolo del colegio.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Módulos activos: {MODULOS.filter((m) => Boolean(estado[m.id])).length} de {MODULOS.length}</span>
          </div>
        </div>

        {cargando ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center font-bold text-slate-500">
            <span className="inline-block animate-spin text-2xl mr-2">⚙️</span>
            Cargando estado de módulos del SuperMotor...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {MODULOS.map((modulo) => {
              const estaActivo = Boolean(estado[modulo.id]);
              const procesando = moduloActualizandose === modulo.nombreApi;

              return (
                <div
                  key={modulo.nombreApi}
                  className={`rounded-3xl border p-5 shadow-sm transition-all duration-200 flex flex-col justify-between ${
                    estaActivo
                      ? `${modulo.colorActivo} shadow-md`
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div>
                    {/* ENCABEZADO DE TARJETA */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm border border-slate-100">
                        {modulo.icono}
                      </span>

                      {modulo.id === "portalActivo" && configuracion?.canalPortalWebActivo === false ? (
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-black tracking-wider bg-amber-500 text-white shadow-sm flex items-center gap-1">
                          <span>🟡</span>
                          <span>MANTENIMIENTO</span>
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black tracking-wider transition ${
                            estaActivo
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {estaActivo ? "ON" : "OFF"}
                        </span>
                      )}
                    </div>

                    {/* TÍTULO Y DESCRIPCIÓN */}
                    <h4 className="mt-4 text-base font-black tracking-tight">
                      {modulo.titulo}
                    </h4>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600 min-h-[38px]">
                      {modulo.descripcion}
                    </p>

                    {modulo.id === "portalActivo" && configuracion?.canalPortalWebActivo === false && (
                      <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200/80 p-2 text-[10px] text-amber-900 font-semibold leading-tight">
                        ⚠️ <strong>Acceso web en mantenimiento:</strong> El subsistema está habilitado en el motor, pero la disponibilidad pública web para familias está cerrada por mantenimiento institucional de seguridad (<code className="font-mono text-[9px] bg-amber-100 px-1 py-0.5 rounded">canalPortalWebActivo = false</code>).
                      </div>
                    )}
                  </div>

                  {/* INTERRUPTOR */}
                  <div className="mt-5 pt-4 border-t border-slate-200/70 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Interruptor
                    </span>

                    <button
                      type="button"
                      id={`switch-${modulo.nombreApi}`}
                      aria-label={`Conmutar módulo ${modulo.titulo}`}
                      disabled={!puedeModificar || procesando || cargando}
                      onClick={() =>
                        void cambiarModulo(modulo.nombreApi, !estaActivo)
                      }
                      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        estaActivo ? "bg-emerald-600" : "bg-slate-300"
                      } ${
                        !puedeModificar || procesando
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:opacity-90"
                      }`}
                    >
                      {procesando ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </span>
                      ) : (
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            estaActivo ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DE CONFIRMACIÓN PARA ENCENDER / APAGAR */}
      {modalConfirmacion.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                {modalConfirmacion.accion === "encender" ? "🟢" : "🔴"}
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Confirmación de Seguridad
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {modalConfirmacion.accion === "encender"
                    ? "¿Está seguro de encender el sistema escolar?"
                    : "¿Está seguro de apagar el sistema escolar?"}
                </h3>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              {modalConfirmacion.accion === "encender"
                ? "Al encender el SuperMotor se reanudará la operatividad escolar. Los módulos configurados como activos (asistencia, notificaciones, etc.) comenzarán a procesar información."
                : "Al apagar el SuperMotor se suspenderán temporalmente los procesos operativos institucionales. Ningún módulo procesará nuevas asistencias o envíos automáticos hasta su reactivación."}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setModalConfirmacion({ abierto: false, accion: "encender" })
                }
                disabled={guardandoMotor}
                className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-confirmar-modal"
                onClick={() =>
                  void cambiarMotorPrincipal(
                    modalConfirmacion.accion === "encender"
                  )
                }
                disabled={guardandoMotor}
                className={`w-full sm:w-auto rounded-xl px-5 py-2.5 text-sm font-black text-white shadow-md transition ${
                  modalConfirmacion.accion === "encender"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                }`}
              >
                {guardandoMotor ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Procesando...</span>
                  </span>
                ) : modalConfirmacion.accion === "encender" ? (
                  "Sí, Encender Sistema"
                ) : (
                  "Sí, Apagar Sistema"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
