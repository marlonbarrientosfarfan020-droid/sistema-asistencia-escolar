"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  FaIdCard,
  FaCamera,
  FaExpand,
  FaCompress,
  FaLightbulb,
  FaSyncAlt,
  FaEye,
  FaEyeSlash,
  FaCrop,
} from "react-icons/fa";
import {
  LuScan,
  LuScanFace,
  LuCamera,
  LuCameraOff,
  LuSettings,
  LuActivity,
  LuLock,
  LuMaximize2,
  LuMinimize2,
  LuRefreshCw,
  LuFocus,
  LuPlay,
  LuPause,
  LuZap,
  LuCreditCard,
  LuClock,
  LuTriangleAlert,
  LuCircleCheck,
  LuShieldCheck,
  LuSlidersHorizontal,
  LuSparkles,
  LuLaptop,
  LuTablet,
} from "react-icons/lu";

import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";
import {
  obtenerConfiguracionTerminal,
  guardarConfiguracionTerminal,
} from "@/lib/terminal-config";
import {
  TerminalConfig,
  TipoDispositivoTerminal,
  CamaraDispositivo,
} from "@/types/terminal";


export const CAMARAS_VIRTUALES_BLACKLIST = [
  "obs",
  "virtual",
  "eshare",
  "droidcam",
  "iriun",
  "manycam",
  "vysor",
  "splitcam",
  "camo",
  "snap camera",
  "ndi",
  "epoccam",
  "camtwist",
  "logi capture",
  "xsplit",
  "sparkocam",
  "animaze",
  "vdo.ninja",
  "fake",
  "dummy",
  "software",
];

export function esCamaraVirtual(label: string): boolean {
  if (!label) return false;
  const l = label.toLowerCase();
  return CAMARAS_VIRTUALES_BLACKLIST.some((palabra) => l.includes(palabra));
}

/**
 * Obtiene el elemento HTMLVideoElement activo sin depender únicamente de selectores DOM frágiles.
 * Utiliza el método oficial getRenderedCameraOrFail().getSurface() de Html5Qrcode si está disponible.
 */
export function obtenerVideoElementActivo(lector?: Html5Qrcode | null): HTMLVideoElement | null {
  try {
    if (lector) {
      const rendered = (lector as any).getRenderedCameraOrFail?.();
      const surface = rendered?.getSurface?.();
      if (surface && surface instanceof HTMLVideoElement) {
        return surface;
      }
    }
  } catch {}

  const contenedor = typeof document !== "undefined" ? document.getElementById("lector-qr") : null;
  const video = contenedor?.querySelector("video") || (typeof document !== "undefined" ? document.querySelector("video") : null);
  return video instanceof HTMLVideoElement ? video : null;
}

/**
 * Negocia y lee la resolución y FPS reales negociados por el sensor de hardware.
 */
export async function obtenerResolucionRealVideo(
  videoEl: HTMLVideoElement | null,
  track?: MediaStreamTrack | null
): Promise<{ width: number; height: number; fps: number }> {
  let settings: MediaTrackSettings = {};
  try {
    if (track?.getSettings) {
      settings = track.getSettings();
    }
  } catch {}

  let width = settings.width || 0;
  let height = settings.height || 0;
  let fps = Math.round(settings.frameRate || 0);

  if (videoEl) {
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      width = videoEl.videoWidth;
      height = videoEl.videoHeight;
    } else {
      // Esperar hasta que metadata esté lista en el elemento de video (máx 600ms)
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          width = videoEl.videoWidth;
          height = videoEl.videoHeight;
          break;
        }
      }
    }
  }

  return { width, height, fps: fps > 0 ? fps : 30 };
}

type EstadoVisual =
  | "normal"
  | "entrada"
  | "salida"
  | "error"
  | "aviso";

type ResultadoAsistencia = {
  ok?: boolean;
  codigoResultado?: string;
  yaRegistrado?: boolean;
  tipo?: "ENTRADA" | "SALIDA";
  hora?: string;
  horaFormateada?: string;
  estado?: string;
  estadoJornada?: string;
  estadoSalida?: string;
  esFueraHorario?: boolean;
  estadoEvidencia?: string;
  fotoUrl?: string | null;
  message?: string;
  estudiante?: {
    id?: number;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    fotoPerfilUrl?: string | null;
  };
  asistencia?: {
    id?: number;
    estado?: string;
    estadoJornada?: string;
    estadoSalida?: string;
    hora?: string;
    horaEntrada?: string;
    horaSalida?: string;
    horaFormateada?: string;
    tipo?: string;
    fotoUrl?: string | null;
    fotoEntrada?: string | null;
    fotoSalida?: string | null;
  };
};

type ResultadoReconocimientoFacial = {
  ok?: boolean;
  reconocido?: boolean;
  message?: string;
  coincidencia?: {
    similitud: number;
    confianzaDeteccion?: number | null;
    faceId?: string;
  };
  estudiante?: {
    id: number;
    codigo: string;
    dni: string;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    turno?: {
      id: number;
      nombre: string;
      horaEntrada: string;
      horaSalida: string;
    } | null;
  };
};

type MarcaReciente = {
  id: number;
  estudiante: string;
  hora: string;
  tipo: string;
  gradoSeccion: string;
  fotoUrl?: string | null;
};

export default function MarcarPage() {
  const router = useRouter();
  const { configuracion } = useConfiguracionColegio();

  // Configuración de la terminal escolar
  const [configTerminal, setConfigTerminal] = useState<TerminalConfig>(
    obtenerConfiguracionTerminal
  );

  const [dni, setDni] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState<ResultadoAsistencia | null>(null);
  const [modoOperativo, setModoOperativo] = useState<"ENTRADA" | "SALIDA">("ENTRADA");

  // Estados de cámara permanente y control
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaraManualApagada, setCamaraManualApagada] = useState(false);
  const [camaraError, setCamaraError] = useState("");
  const [iniciandoCamara, setIniciandoCamara] = useState(false);

  // Estado dinámico del lector QR
  const [estadoLecturaQR, setEstadoLecturaQR] = useState<"esperando" | "detectado" | "listo">("esperando");

  // Evidencia y reconocimientos biométricos
  const [tomandoFoto, setTomandoFoto] = useState(false);
  const [reconociendoFacial, setReconociendoFacial] = useState(false);
  const [estadoVisual, setEstadoVisual] = useState<EstadoVisual>("normal");

  // Control de terminal y seguridad criptográfica
  const [terminalAutorizado, setTerminalAutorizado] = useState<boolean | null>(null);
  const [terminalIdInput, setTerminalIdInput] = useState("");
  const [terminalTokenInput, setTerminalTokenInput] = useState("");
  const [errorTerminal, setErrorTerminal] = useState("");
  const [validandoTerminal, setValidandoTerminal] = useState(false);
  const [esPantallaCompleta, setEsPantallaCompleta] = useState(false);

  // Cámaras disponibles detectadas
  const [camaras, setCamaras] = useState<CamaraDispositivo[]>([]);
  const [camaraQrSeleccionada, setCamaraQrSeleccionada] = useState("");
  const [camaraFacialSeleccionada, setCamaraFacialSeleccionada] = useState("");
  const [cargandoCamaras, setCargandoCamaras] = useState(false);

  // Modales de Diagnóstico y Configuración de Terminal
  const [diagnosticoAbierto, setDiagnosticoAbierto] = useState(false);
  const [panelConfigAbierto, setPanelConfigAbierto] = useState(false);

  // Métricas de Diagnóstico en Vivo
  const [diagnostico, setDiagnostico] = useState<{
    resolucion: string;
    fps: number;
    camaraLabel: string;
    tipoCamara: string;
    estado: string;
    ultimaLectura: string;
    tiempoLecturaMs: number;
    tiempoLecturaSegundos: string;
    focusMode?: string;
    zoomSoportado?: boolean;
    zoomActual?: number;
  }>({
    resolucion: "1920x1080",
    fps: 20,
    camaraLabel: "Cámara en espera",
    tipoCamara: "Cámara HD",
    estado: "Iniciando",
    ultimaLectura: "Ninguna aún",
    tiempoLecturaMs: 0,
    tiempoLecturaSegundos: "0.0s",
    focusMode: "Continuo",
    zoomSoportado: false,
    zoomActual: 1,
  });

  // Capacidades de Enfoque, Linterna y Zoom por hardware
  const [soportaZoom, setSoportaZoom] = useState(false);
  const [rangoZoom, setRangoZoom] = useState<{ min: number; max: number; step: number }>({ min: 1, max: 1, step: 0.1 });
  const [nivelZoom, setNivelZoom] = useState(1);
  const [mejorandoEnfoque, setMejorandoEnfoque] = useState(false);
  const [soportaLinterna, setSoportaLinterna] = useState(false);
  const [linternaActiva, setLinternaActiva] = useState(false);

  // V2 UI Enhancements
  const [guiaVisual, setGuiaVisual] = useState(true);
  const [ajusteVideo, setAjusteVideo] = useState<"contain" | "cover">("contain");
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [horaActual, setHoraActual] = useState("");
  const [pestanaSidebar, setPestanaSidebar] = useState<"dni" | "facial" | "historial">("dni");
  const [historialMarcas, setHistorialMarcas] = useState<MarcaReciente[]>([]);

  // ?ltima lectura realizada en la terminal
  const [ultimaLectura, setUltimaLectura] = useState<{
    estudiante: string;
    hora: string;
    tipo?: string;
    gradoSeccion?: string;
  } | null>(null);

  // Referencias para el control seguro del ciclo de vida y concurrencia (Mutex)
  const procesandoQR = useRef(false);
  const ultimoCodigoLeidoRef = useRef<{ codigo: string; timestamp: number }>({ codigo: "", timestamp: 0 });
  const reconexionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamFotoRef = useRef<MediaStream | null>(null);

  // CONTROLADOR ÚNICO DE CICLO DE VIDA (MUTEX ANTI-COLISIÓN)
  const colaOperacionesCamaraRef = useRef<Promise<any>>(Promise.resolve());
  const desmontadoRef = useRef(false);
  const autoInicioEjecutadoRef = useRef(false);
  const reintentosFallidosRef = useRef(0);
  const MAX_REINTENTOS_AUTOMATICOS = 2;

  // Serializador seguro de operaciones de cámara
  function encolarOperacionCamara<T>(nombre: string, operacion: () => Promise<T>): Promise<T> {
    const tarea = colaOperacionesCamaraRef.current
      .catch((err) => {
        console.warn(`[MUTEX CAMARA] Error en cola previa antes de ${nombre}:`, err);
      })
      .then(async () => {
        if (desmontadoRef.current) return;
        return await operacion();
      });

    colaOperacionesCamaraRef.current = tarea;
    return tarea as Promise<T>;
  }

  // Reloj digital en vivo en hora peruana
  useEffect(() => {
    const actualizarHora = () => {
      const now = new Date();
      setHoraActual(
        now.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "America/Lima",
        })
      );
    };
    actualizarHora();
    const interval = setInterval(actualizarHora, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. Autorización de terminal y configuración inicial
  useEffect(() => {
    desmontadoRef.current = false;
    const logueado = localStorage.getItem("logueado");
    const terminalIdLocal = localStorage.getItem("terminal_id");
    const terminalTokenLocal = localStorage.getItem("terminal_token");

    if (logueado === "true" || (terminalIdLocal && terminalTokenLocal)) {
      setTerminalAutorizado(true);
      const cfg = obtenerConfiguracionTerminal();
      setConfigTerminal(cfg);
      setCamaraQrSeleccionada(cfg.camaraSeleccionada);
      void actualizarListaDispositivos(true);
    } else {
      setTerminalAutorizado(false);
      return;
    }

    window.history.pushState(null, "", window.location.href);
    const bloquearAtras = () => {
      window.history.pushState(null, "", window.location.href);
    };

    const onDeviceChange = () => {
      void actualizarListaDispositivos();
    };

    // Recuperación inteligente al volver a la pestaña (Android Chrome, iOS Safari, etc.)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!desmontadoRef.current && !camaraManualApagada && autoInicioEjecutadoRef.current) {
          const videoEl = obtenerVideoElementActivo(scannerRef.current);
          const stream = videoEl?.srcObject as MediaStream | null;
          const track = stream?.getVideoTracks()?.[0];
          const streamDetenido = !track || track.readyState !== "live" || track.muted;
          const videoPausado = !videoEl || videoEl.paused || videoEl.ended;

          if (streamDetenido || videoPausado) {
            console.warn("[TERMINAL V2] Pestaña reactivada tras suspensión/background. Restaurando cámara permanente...");
            void activarCamaraPermanente();
          }
        }
      }
    };

    window.addEventListener("popstate", bloquearAtras);
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onFullscreenChange = () => {
      setEsPantallaCompleta(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      desmontadoRef.current = true;
      if (reconexionTimerRef.current) {
        clearTimeout(reconexionTimerRef.current);
        reconexionTimerRef.current = null;
      }
      window.removeEventListener("popstate", bloquearAtras);
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      detenerCamaraFoto();
      void liberarRecursosCamara();
    };
  }, [router, camaraManualApagada]);

  // 2. Auto-iniciar cámara permanente (1 sola vez protegida contra StrictMode)
  useEffect(() => {
    if (
      terminalAutorizado === true &&
      !camaraManualApagada &&
      !autoInicioEjecutadoRef.current
    ) {
      autoInicioEjecutadoRef.current = true;
      void activarCamaraPermanente();
    }
  }, [terminalAutorizado, camaraManualApagada]);

  function nombreCamara(dispositivo: MediaDeviceInfo, indice: number) {
    return dispositivo.label.trim() || `Cámara ${indice + 1}`;
  }

  // Selección inteligente de cámara predeterminada evitando cámaras virtuales desconectadas
  // Selección inteligente de cámara predeterminada evitando cámaras virtuales desconectadas
  function elegirCamaraPredeterminada({
    dispositivos,
    preferencia,
    tipo,
    tipoDispositivo,
  }: {
    dispositivos: CamaraDispositivo[];
    preferencia: string;
    tipo: "QR" | "FACIAL";
    tipoDispositivo: TipoDispositivoTerminal;
  }) {
    if (dispositivos.length === 0) return "";

    // Separar cámaras físicas reales de cámaras virtuales
    const camarasFisicas = dispositivos.filter((c) => !esCamaraVirtual(c.label));
    const listaCandidatas = camarasFisicas.length > 0 ? camarasFisicas : dispositivos;

    // 1. Respetar preferencia del usuario SÓLO si existe Y NO es una cámara virtual
    if (preferencia) {
      const encontrada = dispositivos.find((c) => c.deviceId === preferencia);
      if (encontrada && !esCamaraVirtual(encontrada.label)) {
        return preferencia;
      }
    }

    // 2. Si es Laptop / PC: SIEMPRE priorizar webcam física integrada o USB
    if (tipoDispositivo === "LAPTOP_PC") {
      const palabrasLaptop = [
        "integrated",
        "integrada",
        "built-in",
        "webcam",
        "front",
        "frontal",
        "user",
        "facetime",
        "hd camera",
        "camera",
        "usb",
      ];
      const encontradaLaptop = listaCandidatas.find((c) =>
        palabrasLaptop.some((p) => c.label.toLowerCase().includes(p))
      );
      if (encontradaLaptop) return encontradaLaptop.deviceId;
      // Por defecto en laptop, el dispositivo físico 0 siempre es la webcam integrada
      return listaCandidatas[0]?.deviceId || "";
    }

    // 3. Si es Tablet / Celular: priorizar cámara trasera estándar / environment
    if (tipo === "QR") {
      const palabrasTrasera = [
        "back",
        "rear",
        "environment",
        "trasera",
        "posterior",
        "facing back",
        "camera 0",
        "0, facing back",
      ];
      const candidatasTraseras = listaCandidatas.filter((c) =>
        palabrasTrasera.some((p) => c.label.toLowerCase().includes(p))
      );

      if (candidatasTraseras.length > 0) {
        // En celulares con múltiples lentes (macro, ultra gran angular 0.5x, estándar 1x):
        // Descartar lentes ultra gran angular que distorsionan el código QR a corta distancia
        const lenteEstandar = candidatasTraseras.find(
          (c) => !/ultra|0\.5x|wide-angle|fisheye/i.test(c.label)
        );
        return (lenteEstandar || candidatasTraseras[0]).deviceId;
      }
      return listaCandidatas[0]?.deviceId || "";
    }

    return listaCandidatas[0]?.deviceId || "";
  }

  async function actualizarListaDispositivos(iniciarCamaraTrasEnum = false) {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setCargandoCamaras(true);

    try {
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      const camarasEncontradas: CamaraDispositivo[] = dispositivos
        .filter((dispositivo) => dispositivo.kind === "videoinput")
        .map((dispositivo, indice) => {
          const lbl = nombreCamara(dispositivo, indice);
          return {
            deviceId: dispositivo.deviceId,
            label: lbl,
            esVirtual: esCamaraVirtual(lbl),
          };
        });

      setCamaras(camarasEncontradas);

      const cfg = obtenerConfiguracionTerminal();
      let preferidaQr = cfg.camaraSeleccionada || localStorage.getItem("camara_qr_device_id") || "";
      const preferidaFacial = localStorage.getItem("camara_facial_device_id") || "";

      // Limpieza de cámara virtual guardada por error (ej. OBS Virtual Camera)
      const camPref = camarasEncontradas.find((c) => c.deviceId === preferidaQr);
      if (camPref && esCamaraVirtual(camPref.label)) {
        console.log(`[CAMARA] Limpiando preferencia virtual previa (${camPref.label}) de almacenamiento local.`);
        preferidaQr = "";
        localStorage.removeItem("camara_qr_device_id");
        guardarConfiguracionTerminal({ camaraSeleccionada: "" });
      }

      const seleccionQr = elegirCamaraPredeterminada({
        dispositivos: camarasEncontradas,
        preferencia: preferidaQr,
        tipo: "QR",
        tipoDispositivo: cfg.tipoDispositivo,
      });

      const seleccionFacial = elegirCamaraPredeterminada({
        dispositivos: camarasEncontradas,
        preferencia: preferidaFacial,
        tipo: "FACIAL",
        tipoDispositivo: cfg.tipoDispositivo,
      });

      setCamaraQrSeleccionada(seleccionQr);
      setCamaraFacialSeleccionada(seleccionFacial);

      if (iniciarCamaraTrasEnum && seleccionQr && !camaraManualApagada && !autoInicioEjecutadoRef.current) {
        autoInicioEjecutadoRef.current = true;
        void activarCamaraPermanente(seleccionQr);
      }
    } catch (error) {
      console.warn("[CAMARAS] Error enumerando dispositivos:", error);
    } finally {
      setCargandoCamaras(false);
    }
  }

  function beep(tipo: "ok" | "error" | "warning") {
    try {
      if (tipo === "warning") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
          return;
        }
      }
      const audio = new Audio(tipo === "ok" ? "/beep-ok.mp3" : "/beep-error.mp3");
      audio.play().catch(() => {});
    } catch {}
  }

  async function esperar(ms: number) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  // Liberación total y garantizada de recursos de cámara (Anti-NotReadableError)
  async function liberarRecursosCamara() {
    if (reconexionTimerRef.current) {
      clearTimeout(reconexionTimerRef.current);
      reconexionTimerRef.current = null;
    }

    // 1. Desconectar listeners de eventos onended para que track.stop() no dispare reconexiones
    try {
      const videoEl = (document.querySelector("#lector-qr video") || document.querySelector("video")) as HTMLVideoElement | null;
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          track.onended = null;
          try {
            track.stop();
          } catch {}
        });
        videoEl.srcObject = null;
      }
    } catch (e) {
      console.warn("[CAMARA] Error deteniendo MediaStreamTracks:", e);
    }

    // 2. Detener la instancia activa de Html5Qrcode
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const estado = scanner.getState();
        if (estado === 2 || estado === 3) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (error) {
        console.warn("[CAMARA] Lector QR detenido limpiamente:", error);
      } finally {
        scannerRef.current = null;
      }
    }

    setLinternaActiva(false);
    setCamaraActiva(false);
    procesandoQR.current = false;

    // Margen para que el subsistema de video del OS (DirectShow / MediaFoundation) libere el lock de hardware
    await esperar(200);
  }

  function detenerCamaraFoto() {
    const stream = streamFotoRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamFotoRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  // 3. Iniciar cámara permanente V2 con Serializador Mutex y Escalera Progresiva de Compatibilidad
  async function activarCamaraPermanente(
    dispositivoIdCustom?: string,
    modoFacingCustom?: "environment" | "user"
  ) {
    return encolarOperacionCamara("activarCamaraPermanente", async () => {
      if (desmontadoRef.current) return;
      setIniciandoCamara(true);
      setCamaraError("");

      await liberarRecursosCamara();
      detenerCamaraFoto();

      const cfg = obtenerConfiguracionTerminal();
      const esLaptop = cfg.tipoDispositivo === "LAPTOP_PC";

      // Si es laptop o PC, siempre usar "user"; en celular/tablet usar preferencia o "environment"
      let facingMode: "environment" | "user" =
        modoFacingCustom ?? (esLaptop ? "user" : cfg.modoCamaraPreferido || "environment");
      if (esLaptop) {
        facingMode = "user";
      }

      // Resolver ID de dispositivo
      let targetDeviceId: string | undefined =
        dispositivoIdCustom ?? camaraQrSeleccionada ?? cfg.camaraSeleccionada;

      // Si el deviceId seleccionado corresponde a una cámara virtual deshabilitada, descartarlo
      if (targetDeviceId) {
        const camEncontrada = camaras.find((c) => c.deviceId === targetDeviceId);
        if (camEncontrada && esCamaraVirtual(camEncontrada.label)) {
          targetDeviceId = undefined;
        }
      }

      // Separación técnica: FPS de decodificación QR (ZXing) vs FPS del MediaStream
      // Laptop: 20 FPS decodificación zxing. Celulares: 18 FPS para evitar sobrecalentamiento y mantener fluidez.
      const decoderFps = esLaptop ? 20 : 18;

      // Escalera de compatibilidad progresiva Full HD -> HD 720p -> SD 480p -> Universal Nativa
      // Ningún nivel impone "exact" rígido que provoque OverconstrainedError en hardware modesto
      const nivelesConstraints: Array<{
        nombre: string;
        videoConstraints: MediaTrackConstraints;
      }> = [
        {
          nombre: "Full HD 1080p (Preferente)",
          videoConstraints: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 30, min: 15 },
          },
        },
        {
          nombre: "HD 720p Estándar",
          videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 30, min: 15 },
          },
        },
        {
          nombre: "SD 480p Universal",
          videoConstraints: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, min: 15 },
          },
        },
        {
          nombre: "Resolución Nativa del Sensor",
          videoConstraints: {
            frameRate: { ideal: 30 },
          },
        },
      ];

      let lectorIniciadoConExito = false;
      let ultimoErrorCapturado: any = null;

      // Intentar niveles progresivos de constraints
      for (const nivel of nivelesConstraints) {
        if (desmontadoRef.current) break;

        try {
          console.log(`[TERMINAL V2] Intentando inicializar cámara (${nivel.nombre})...`);

          const lector = new Html5Qrcode("lector-qr", {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
          });
          scannerRef.current = lector;

          // Constraints limpias: si hay targetDeviceId, NO mezclar con facingMode incompatible
          const finalConstraints: MediaTrackConstraints = { ...nivel.videoConstraints };
          let cameraTarget: any = {};

          if (targetDeviceId) {
            cameraTarget = { deviceId: { exact: targetDeviceId } };
          } else {
            cameraTarget = { facingMode };
            finalConstraints.facingMode = facingMode;
          }

          // Solicitar foco continuo en advanced solo si el navegador soporta la constraint
          try {
            const supported = navigator.mediaDevices?.getSupportedConstraints?.();
            if (supported && (supported as any).focusMode) {
              finalConstraints.advanced = [{ focusMode: "continuous" } as any];
            }
          } catch {}

          // Iniciar escáner: SIN 'qrbox' para escaneo completo sobre 100% del fotograma
          await lector.start(
            cameraTarget,
            {
              fps: decoderFps,
              videoConstraints: finalConstraints,
            },
            async (codigoLeido) => {
              const codigoSanitizado = codigoLeido.trim().replace(/^(CODIGO|DNI|ID)[:\s]+/i, "").trim();
              const ahora = Date.now();

              // Prevención inteligente de lecturas duplicadas: 3.5s cooldown para el MISMO carnet
              if (
                ultimoCodigoLeidoRef.current.codigo === codigoSanitizado &&
                ahora - ultimoCodigoLeidoRef.current.timestamp < 3500
              ) {
                return;
              }

              // Si hay una transacción de red en curso, no procesar lecturas concurrentes
              if (procesandoQR.current) {
                return;
              }

              ultimoCodigoLeidoRef.current = { codigo: codigoSanitizado, timestamp: ahora };
              procesandoQR.current = true;
              await procesarLecturaQRContinuo(codigoSanitizado);
            },
            () => {}
          );

          // Inicialización exitosa
          lectorIniciadoConExito = true;
          setCamaraActiva(true);
          setCamaraManualApagada(false);
          setCamaraError("");
          reintentosFallidosRef.current = 0;

          await aplicarOptimizacionesHardwareTrack(lector);
          void actualizarListaDispositivos();

          console.log(`[TERMINAL V2] Cámara activa exitosamente con perfil: ${nivel.nombre}`);
          break;
        } catch (err: any) {
          ultimoErrorCapturado = err;
          console.warn(`[TERMINAL V2] Falló inicialización con ${nivel.nombre}:`, err?.name || err?.message || err);
          await liberarRecursosCamara();
          await esperar(200);

          // Si falló usando un ID específico (ej. cámara virtual desconectada), reintentar sin ID
          if (targetDeviceId && nivel === nivelesConstraints[0]) {
            console.log("[TERMINAL V2] Descartando deviceId para probar cámara física predeterminada...");
            targetDeviceId = undefined;
          }
        }
      }

      if (!lectorIniciadoConExito && !desmontadoRef.current) {
        scannerRef.current = null;
        setCamaraActiva(false);

        const errName = ultimoErrorCapturado?.name || "";
        const errMsg = (ultimoErrorCapturado?.message || "").toLowerCase();

        if (
          errName === "NotReadableError" ||
          errMsg.includes("could not start video source") ||
          errMsg.includes("notreadable")
        ) {
          setCamaraError(
            "No se pudo iniciar la cámara. Comprueba que ninguna otra aplicación (o cámara virtual) la esté utilizando e intenta nuevamente."
          );
        } else if (
          errName === "NotAllowedError" ||
          errMsg.includes("permission") ||
          errMsg.includes("denied")
        ) {
          setCamaraError(
            "Permiso de cámara denegado. Active el acceso a la cámara en el navegador para registrar asistencia."
          );
        } else if (
          errName === "NotFoundError" ||
          errName === "DevicesNotFoundError" ||
          errMsg.includes("not found")
        ) {
          setCamaraError("No se detectó ninguna cámara disponible en el dispositivo.");
        } else if (errName === "OverconstrainedError") {
          setCamaraError("La cámara seleccionada no soporta las características solicitadas. Selecciona otra cámara en Configuración.");
        } else {
          setCamaraError("Cámara desconectada o no disponible. Revisa la conexión e intenta nuevamente.");
        }
      }

      setIniciandoCamara(false);
    });
  }

  // 3.1 Inspección y optimización de hardware segura: AutoFocus, Zoom, Linterna y Diagnóstico Real
  async function aplicarOptimizacionesHardwareTrack(lectorInstancia?: Html5Qrcode | null) {
    try {
      await esperar(300);
      const videoEl = obtenerVideoElementActivo(lectorInstancia || scannerRef.current);
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];

      let focusModeDetectado = "Estándar";
      let soportaZ = false;
      let zMin = 1;
      let zMax = 1;
      let zStep = 0.1;
      let zoomActual = 1;

      if (track) {
        // Watchdog protegido contra bucles infinitos (máximo 2 intentos automáticos)
        track.onended = () => {
          if (desmontadoRef.current || camaraManualApagada) return;

          if (reintentosFallidosRef.current >= MAX_REINTENTOS_AUTOMATICOS) {
            console.warn("[TERMINAL V2] Límite de reconexiones automáticas alcanzado.");
            setCamaraError(
              "La señal de la cámara se interrumpió. Presiona 'Reintentar Conexión' o selecciona otra cámara."
            );
            setCamaraActiva(false);
            return;
          }

          reintentosFallidosRef.current += 1;
          console.warn(`[TERMINAL V2] Reconexión automática (${reintentosFallidosRef.current}/${MAX_REINTENTOS_AUTOMATICOS})...`);

          if (reconexionTimerRef.current) clearTimeout(reconexionTimerRef.current);
          reconexionTimerRef.current = setTimeout(() => {
            void activarCamaraPermanente();
          }, 2000);
        };

        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};

        // Linterna (Torch API de hardware)
        if ("torch" in capabilities) {
          setSoportaLinterna(true);
        } else {
          setSoportaLinterna(false);
        }

        // AutoFocus continuo SOLO si el hardware lo soporta
        const advanced: any = {};
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
          if (capabilities.focusMode.includes("continuous")) {
            advanced.focusMode = "continuous";
            focusModeDetectado = "Continuo";
          } else if (capabilities.focusMode.includes("auto")) {
            advanced.focusMode = "auto";
            focusModeDetectado = "Automático";
          }
        }

        // Zoom por hardware SOLO si el hardware lo soporta
        if (capabilities.zoom) {
          soportaZ = true;
          zMin = capabilities.zoom.min || 1;
          zMax = capabilities.zoom.max || 5;
          zStep = capabilities.zoom.step || 0.1;
          const settings: any = track.getSettings ? track.getSettings() : {};
          zoomActual = settings.zoom || 1;
          setSoportaZoom(true);
          setRangoZoom({ min: zMin, max: zMax, step: zStep });
          setNivelZoom(zoomActual);
        } else {
          setSoportaZoom(false);
        }

        if (Object.keys(advanced).length > 0) {
          try {
            await track.applyConstraints({ advanced: [advanced] });
          } catch (eAdv) {
            console.warn("[CAMARA] applyConstraints avanzado ignorado por driver:", eAdv);
          }
        }
      }

      // Obtener resolución y FPS REALES negociados por el sensor de hardware
      const { width: realWidth, height: realHeight, fps: realFps } =
        await obtenerResolucionRealVideo(videoEl, track);

      const cfg = obtenerConfiguracionTerminal();
      const devId = camaraQrSeleccionada;
      const encontrada = camaras.find((c) => c.deviceId === devId);
      const camLabel =
        encontrada?.label ||
        (cfg.tipoDispositivo === "LAPTOP_PC"
          ? "Webcam Integrada HD"
          : "Cámara Trasera HD");
      const tipoCam = camLabel.toLowerCase().includes("usb")
        ? "USB"
        : camLabel.toLowerCase().includes("integrated") || cfg.tipoDispositivo === "LAPTOP_PC"
        ? "Webcam Integrada"
        : "Cámara Móvil / Tablet";

      const estadoResolucion =
        realWidth >= 1920 && realHeight >= 1080
          ? "Full HD (1080p)"
          : realWidth >= 1280 && realHeight >= 720
          ? "HD Estándar (720p)"
          : realWidth >= 640 && realHeight >= 480
          ? "SD Estándar (480p)"
          : realWidth > 0
          ? `Nativa (${realWidth}x${realHeight})`
          : "Conectada";

      setDiagnostico((prev) => ({
        ...prev,
        resolucion: realWidth > 0 && realHeight > 0 ? `${realWidth}x${realHeight}` : "Negociando...",
        fps: realFps > 0 ? realFps : 30,
        camaraLabel: camLabel,
        tipoCamara: tipoCam,
        estado: estadoResolucion,
        focusMode: focusModeDetectado,
        zoomSoportado: soportaZ,
        zoomActual,
      }));
    } catch (err) {
      console.warn("[CAMARA] No se pudo leer diagnóstico detallado:", err);
    }
  }

  // 3.2 Aplicar Zoom en tiempo real
  async function aplicarZoom(nuevoZoom: number) {
    try {
      setNivelZoom(nuevoZoom);
      const video = obtenerVideoElementActivo(scannerRef.current);
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      if (track && track.getCapabilities) {
        const capabilities: any = track.getCapabilities();
        if (capabilities.zoom) {
          const clamped = Math.max(capabilities.zoom.min || 1, Math.min(capabilities.zoom.max || 5, nuevoZoom));
          await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
          setDiagnostico((prev) => ({ ...prev, zoomActual: clamped }));
        }
      }
    } catch (err) {
      console.warn("[CAMARA] Error aplicando zoom:", err);
    }
  }

  // 3.3 Alternar linterna / flash (Torch API)
  async function alternarLinterna() {
    try {
      const video = obtenerVideoElementActivo(scannerRef.current);
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      if (track) {
        const nuevo = !linternaActiva;
        await track.applyConstraints({ advanced: [{ torch: nuevo } as any] });
        setLinternaActiva(nuevo);
      }
    } catch (err) {
      console.warn("[CAMARA] Error alternando linterna:", err);
    }
  }

  // 3.4 1-Tap Girar Cámara inteligente (Laptop vs Celular)
  async function girarCamara() {
    const cfg = obtenerConfiguracionTerminal();
    const esLaptop = cfg.tipoDispositivo === "LAPTOP_PC";

    // Si es Laptop o solo hay una cámara detectada
    if (esLaptop || camaras.length <= 1) {
      if (camaras.length > 1) {
        // En laptop con múltiples cámaras (ej: webcam + USB), ciclar a la siguiente física
        const idxActual = camaras.findIndex((c) => c.deviceId === camaraQrSeleccionada);
        const siguiente = camaras[(idxActual + 1) % camaras.length];
        if (siguiente) {
          await cambiarCamaraEnVivo(siguiente.deviceId);
          setMensaje(`📷 Cámara: ${siguiente.label}`);
          return;
        }
      }
      setMensaje("📷 Webcam única detectada en este equipo.");
      return;
    }

    // Si es móvil / tablet: alternar entre trasera y delantera
    const nuevoModo: "environment" | "user" =
      cfg.modoCamaraPreferido === "user" ? "environment" : "user";
    const nuevaCfg = guardarConfiguracionTerminal({
      modoCamaraPreferido: nuevoModo,
      camaraSeleccionada: "",
    });
    setConfigTerminal(nuevaCfg);
    setCamaraQrSeleccionada("");
    await activarCamaraPermanente(undefined, nuevoModo);
  }

  // 3.5 Calibrar enfoque sin reiniciar innecesariamente el stream
  async function mejorarEnfoque() {
    if (mejorandoEnfoque) return;
    setMejorandoEnfoque(true);
    setMensaje("🔍 Calibrando enfoque...");

    try {
      const videoEl = obtenerVideoElementActivo(scannerRef.current);
      const track = (videoEl?.srcObject as MediaStream)?.getVideoTracks()?.[0];
      let calibradoEnCaliente = false;

      if (track && track.getCapabilities) {
        const caps: any = track.getCapabilities();
        if (caps.focusMode && Array.isArray(caps.focusMode)) {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
            calibradoEnCaliente = true;
          } catch {}
        }
      }

      if (!calibradoEnCaliente) {
        await activarCamaraPermanente(camaraQrSeleccionada || undefined);
      }

      setMensaje("✓ Enfoque optimizado.");
      setTimeout(() => {
        if (estadoLecturaQR === "listo") {
          setMensaje("Listo siguiente estudiante.");
        }
      }, 2000);
    } catch (err) {
      console.error("[CAMARA] Error al calibrar enfoque:", err);
      setMensaje("⚠️ Error al calibrar enfoque");
    } finally {
      setMejorandoEnfoque(false);
    }
  }

  // 4. Control Manual: Apagar cámara
  async function apagarCamaraManual() {
    return encolarOperacionCamara("apagarCamaraManual", async () => {
      await liberarRecursosCamara();
      setCamaraManualApagada(true);
      setCamaraActiva(false);
      setMensaje("La cámara está desactivada");
      setEstadoVisual("normal");
    });
  }

  // 5. Cambio en caliente de cámara serializado
  async function cambiarCamaraEnVivo(deviceId: string) {
    setCamaraQrSeleccionada(deviceId);
    guardarConfiguracionTerminal({ camaraSeleccionada: deviceId });
    await activarCamaraPermanente(deviceId);
  }

  // 6. Cambio de tipo de dispositivo (Laptop vs Tablet) en caliente
  async function cambiarTipoDispositivoEnVivo(tipo: TipoDispositivoTerminal) {
    const modo: "environment" | "user" = tipo === "TABLET_CELULAR" ? "environment" : "user";
    const nuevaCfg = guardarConfiguracionTerminal({
      tipoDispositivo: tipo,
      modoCamaraPreferido: modo,
    });
    setConfigTerminal(nuevaCfg);
    await activarCamaraPermanente(undefined, modo);
  }

  // Alternar entre cámara trasera y delantera en Tablet/Celular
  async function alternarFacingModeMobile(modo: "environment" | "user") {
    const nuevaCfg = guardarConfiguracionTerminal({
      modoCamaraPreferido: modo,
      camaraSeleccionada: "",
    });
    setConfigTerminal(nuevaCfg);
    setCamaraQrSeleccionada("");
    await activarCamaraPermanente(undefined, modo);
  }

  // 7. Extracción de fotograma instantáneo desde el sensor mediante Canvas
  async function capturarFotoDesdeVideoActual(): Promise<Blob | null> {
    try {
      const video = obtenerVideoElementActivo(scannerRef.current);
      if (!video) {
        console.warn("[FOTO DEBUG] Elemento de video no disponible.");
        return null;
      }

      // 1. Validar que el video tenga dimensiones activas y fotograma cargado
      if (video.videoWidth <= 0 || video.videoHeight <= 0 || video.readyState < 2) {
        console.warn(
          `[FOTO DEBUG] Video no listo para captura (dimensiones: ${video.videoWidth}x${video.videoHeight}, readyState: ${video.readyState}).`
        );
        return null;
      }

      // 2. Validar que el MediaStreamTrack esté en estado live
      const stream = video.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      if (track && (track.readyState !== "live" || !track.enabled)) {
        console.warn("[FOTO DEBUG] MediaStreamTrack no está activo/live.");
        return null;
      }

      // 3. Crear canvas para captura nítida (máximo 720px de ancho conservando aspecto)
      const canvas = document.createElement("canvas");
      const anchoMax = 720;
      const escala = Math.min(1, anchoMax / video.videoWidth);
      const ancho = Math.round(video.videoWidth * escala);
      const alto = Math.round(video.videoHeight * escala);
      canvas.width = ancho;
      canvas.height = alto;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, ancho, alto);

      // 4. Muestreo de luminancia para descartar fotogramas totalmente negros o vacíos
      try {
        const muestra = ctx.getImageData(0, 0, Math.min(ancho, 32), Math.min(alto, 32)).data;
        let suma = 0;
        for (let i = 0; i < muestra.length; i += 4) {
          suma += muestra[i] + muestra[i + 1] + muestra[i + 2];
        }
        if (suma === 0) {
          console.warn("[FOTO DEBUG] Fotograma negro detectado; descartando.");
          canvas.width = 0;
          canvas.height = 0;
          return null;
        }
      } catch {}

      // 5. Compresión JPEG con balance óptimo calidad/peso (calidad 0.80)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
      });

      // Liberar recursos de memoria del canvas
      canvas.width = 0;
      canvas.height = 0;

      if (blob && blob.size > 1000 && blob.type === "image/jpeg") {
        return blob;
      }
    } catch (err) {
      console.warn("[FOTO DEBUG] Error al capturar fotograma desde video:", err);
    }
    return null;
  }

  // 8. Subida asíncrona de fotografía en segundo plano con confirmación real
  async function subirFotoAsincrona(
    foto: Blob,
    asistenciaId: number,
    tipo?: string
  ): Promise<string> {
    const terminalId = localStorage.getItem("terminal_id");
    const terminalToken = localStorage.getItem("terminal_token");
    const maxIntentos = 3;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      const formData = new FormData();
      formData.append(
        "foto",
        new File([foto], `asistencia-${asistenciaId}-${Date.now()}.jpg`, { type: "image/jpeg" })
      );
      formData.append("asistenciaId", String(asistenciaId));
      formData.append("tipo", tipo || modoOperativo || "ENTRADA");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      try {
        const respuesta = await fetch("/api/asistencias/foto", {
          method: "POST",
          credentials: "include",
          headers: {
            ...(terminalId && terminalToken
              ? {
                  "x-terminal-id": terminalId,
                  "x-terminal-token": terminalToken,
                }
              : {}),
          },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await respuesta.json().catch(() => null);

        if (respuesta.ok && data?.ok && data.fotoUrl) {
          // Sincronización confirmada: actualizar historial y badge
          setHistorialMarcas((prev) =>
            prev.map((m) => (m.id === asistenciaId ? { ...m, fotoUrl: data.fotoUrl } : m))
          );
          setResultado((prev) => {
            if (prev && (prev.asistencia?.id === asistenciaId || !prev.asistencia?.id)) {
              return {
                ...prev,
                fotoUrl: data.fotoUrl,
                estadoEvidencia: "Foto guardada en nube",
              };
            }
            return prev;
          });
          return data.fotoUrl;
        }

        if (data?.limiteAlcanzado || data?.completada) {
          return data?.fotoUrl || "";
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.warn(`[FOTO ASINCRONA] Reintento ${intento}/${maxIntentos}:`, error?.message || error);
      }

      if (intento < maxIntentos) {
        await esperar(intento * 1000);
      }
    }

    // Si falló tras todos los reintentos: actualizar estado sin afirmar falsamente foto guardada
    setResultado((prev) => {
      if (prev && (prev.asistencia?.id === asistenciaId || !prev.asistencia?.id)) {
        return {
          ...prev,
          estadoEvidencia: "Foto no guardada (error de sincronización)",
        };
      }
      return prev;
    });

    return "";
  }

  // 9. FLUJO PROFESIONAL V2: Asistencia inmediata con captura no-bloqueante
  async function procesarLecturaQRContinuo(codigo: string) {
    const tInicio = performance.now();
    console.log("[TERMINAL V2] QR recibido para procesamiento:", codigo);

    setEstadoLecturaQR("detectado");
    setMensaje("⏳ Código detectado. Validando...");
    beep("ok");

    try {
      const fotoBlob = await capturarFotoDesdeVideoActual();

      const codigoLimpio = codigo.trim().replace(/^(CODIGO|DNI|ID)[:\s]+/i, "").trim();
      const esDniNumerico = /^\d{8}$/.test(codigoLimpio);

      const payload = esDniNumerico
        ? { dni: codigoLimpio, codigo: codigoLimpio, metodo: "QR", intencionOperativa: modoOperativo }
        : { codigo: codigoLimpio, metodo: "QR", intencionOperativa: modoOperativo };

      await ejecutarRegistroAsistencia(payload, fotoBlob);

      const tiempoLecturaMs = Math.round(performance.now() - tInicio);
      const tiempoSegundos = (tiempoLecturaMs / 1000).toFixed(1);

      setDiagnostico((prev) => ({
        ...prev,
        tiempoLecturaMs,
        tiempoLecturaSegundos: `${tiempoSegundos} segundos`,
        ultimaLectura: codigoLimpio,
      }));
    } catch (err) {
      console.error("[QR DEBUG] Error en procesarLecturaQRContinuo:", err);
      setMensaje("⚠️ Error procesando marcación");
      beep("error");
    } finally {
      await esperar(1000);

      setResultado(null);
      setMensaje("Listo siguiente estudiante.");
      setEstadoLecturaQR("listo");
      setEstadoVisual("normal");
      procesandoQR.current = false;
    }
  }

  // 10. Función central de registro de asistencia prioritario (< 400ms)
  async function ejecutarRegistroAsistencia(
    datos: {
      dni?: string;
      codigo?: string;
      metodo: string;
      idempotencyKey?: string;
      clientTimestamp?: number;
      intencionOperativa?: "AUTO" | "ENTRADA" | "SALIDA";
    },
    fotoBlob: Blob | null
  ) {
    const terminalId = localStorage.getItem("terminal_id");
    const terminalToken = localStorage.getItem("terminal_token");

    // Clave única por operación de marcación para garantizar idempotencia estricta
    const idempotencyKey =
      datos.idempotencyKey ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    const clientTimestamp = datos.clientTimestamp || Date.now();
    const intencionOperativa = datos.intencionOperativa || modoOperativo || "ENTRADA";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch("/api/asistencias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
          ...(terminalId && terminalToken
            ? {
                "x-terminal-id": terminalId,
                "x-terminal-token": terminalToken,
              }
            : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          ...datos,
          idempotencyKey,
          clientTimestamp,
          intencionOperativa,
          fotoUrl: null,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data: ResultadoAsistencia = await res.json();

      // Determinar código de resultado estructurado
      const codigoResultado = data.codigoResultado || (
        data.yaRegistrado
          ? (data.tipo === "SALIDA" ? "SALIDA_YA_REGISTRADA" : "ASISTENCIA_YA_REGISTRADA")
          : (data.tipo === "SALIDA" ? "SALIDA_REGISTRADA" : "ENTRADA_REGISTRADA")
      );

      const horaFormateada =
        data.horaFormateada ||
        data.hora ||
        data.asistencia?.horaFormateada ||
        data.asistencia?.hora ||
        (data.tipo === "SALIDA"
          ? (data.asistencia?.horaSalida ? new Date(data.asistencia.horaSalida).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Lima" }) : "--:--")
          : (data.asistencia?.horaEntrada ? new Date(data.asistencia.horaEntrada).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Lima" }) : "--:--"));

      if (!res.ok && codigoResultado !== "ASISTENCIA_YA_REGISTRADA" && codigoResultado !== "SALIDA_YA_REGISTRADA") {
        if (codigoResultado === "FUERA_DE_HORARIO" || data.esFueraHorario) {
          setResultado({
            ...data,
            codigoResultado: "FUERA_DE_HORARIO",
            hora: horaFormateada,
            horaFormateada,
          });
          setMensaje(`🚫 ${data.message || "Operación fuera de horario escolar"}`);
          setEstadoVisual("error");
          beep("error");
          return;
        }

        const msg = data.message || `No se pudo registrar asistencia (${res.status})`;
        setResultado({
          ...data,
          codigoResultado: "ERROR_DE_REGISTRO",
          message: msg,
        });
        setMensaje(`⚠️ ${msg}`);
        setEstadoVisual("error");
        beep("error");
        return;
      }

      // Procesar estados exitosos o ya registrados
      if (codigoResultado === "ENTRADA_REGISTRADA") {
        setResultado({
          ...data,
          codigoResultado,
          hora: horaFormateada,
          horaFormateada,
          fotoUrl: data.asistencia?.fotoUrl || null,
          estadoEvidencia: fotoBlob ? "Foto pendiente de sincronización" : "Sin foto",
        });
        setMensaje(`✓ ${data.message || "Entrada registrada correctamente"}`);
        setEstadoVisual("entrada");
        beep("ok");
      } else if (codigoResultado === "ASISTENCIA_YA_REGISTRADA") {
        setResultado({
          ...data,
          codigoResultado,
          tipo: "ENTRADA",
          hora: horaFormateada,
          horaFormateada,
          estadoEvidencia: "Entrada previa conservada",
        });
        setMensaje(`⚠️ Entrada ya registrada previamente`);
        setEstadoVisual("aviso");
        beep("warning");
      } else if (codigoResultado === "SALIDA_REGISTRADA") {
        setResultado({
          ...data,
          codigoResultado,
          tipo: "SALIDA",
          hora: horaFormateada,
          horaFormateada,
          fotoUrl: data.asistencia?.fotoSalida || null,
          estadoEvidencia: fotoBlob ? "Foto de salida pendiente" : "Sin foto",
        });
        setMensaje(`✓ ${data.message || "Salida registrada correctamente"}`);
        setEstadoVisual("salida");
        beep("ok");
      } else if (codigoResultado === "SALIDA_YA_REGISTRADA") {
        setResultado({
          ...data,
          codigoResultado,
          tipo: "SALIDA",
          hora: horaFormateada,
          horaFormateada,
          estadoEvidencia: "Salida previa conservada",
        });
        setMensaje(`⚠️ Salida ya registrada previamente`);
        setEstadoVisual("aviso");
        beep("warning");
      }

      if (fotoBlob && data.asistencia?.id) {
        void subirFotoAsincrona(fotoBlob, data.asistencia.id, data.tipo);
      }

      if (data.estudiante) {
        const horaFormateada =
          data.asistencia?.horaFormateada ||
          data.asistencia?.hora ||
          new Date().toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Lima",
          });

        const nuevaMarca: MarcaReciente = {
          id: data.asistencia?.id || Date.now(),
          estudiante: `${data.estudiante.nombres} ${data.estudiante.apellidos}`,
          hora: horaFormateada,
          tipo: data.tipo || "ENTRADA",
          gradoSeccion: `${data.estudiante.grado} - ${data.estudiante.seccion}`,
          fotoUrl: data.asistencia?.fotoUrl || null,
        };

        setHistorialMarcas((prev) => [nuevaMarca, ...prev.slice(0, 4)]);

        setUltimaLectura({
          estudiante: `${data.estudiante.nombres} ${data.estudiante.apellidos}`,
          hora: horaFormateada,
          tipo: data.tipo,
          gradoSeccion: `${data.estudiante.grado} - ${data.estudiante.seccion}`,
        });

        setDiagnostico((prev) => ({
          ...prev,
          ultimaLectura: `${data.estudiante?.nombres} ${data.estudiante?.apellidos}`,
        }));
      }
    } catch (err: any) {
      console.error("[TERMINAL V2] Error en registro:", err);
      setMensaje(`⚠️ ${err.message || "Error al registrar asistencia"}`);
      setEstadoVisual("error");
      beep("error");
    }
  }

  // Marcación manual por DNI
  async function marcarPorDni() {
    if (!dni.trim() || dni.length !== 8) {
      setMensaje("⚠️ Ingrese un DNI válido de 8 dígitos");
      setEstadoVisual("error");
      return;
    }

    const foto = await capturarFotoDesdeVideoActual();
    await ejecutarRegistroAsistencia({ dni: dni.trim(), metodo: "DNI" }, foto);
    setDni("");
  }

  function manejarEnterDni(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void marcarPorDni();
    }
  }

  // Marcación facial auxiliar
  async function marcarPorRostroAuxiliar() {
    if (tomandoFoto || reconociendoFacial) return;

    setReconociendoFacial(true);
    setResultado(null);
    setEstadoVisual("normal");
    setMensaje("👤 Mire hacia la cámara para reconocimiento facial...");

    try {
      const foto = await capturarFotoDesdeVideoActual();
      if (!foto) {
        throw new Error("No se pudo capturar imagen de la cámara");
      }

      const formData = new FormData();
      formData.append(
        "foto",
        new File([foto], `facial-${Date.now()}.jpg`, { type: "image/jpeg" })
      );

      const respuesta = await fetch("/api/biometria/reconocer", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data: ResultadoReconocimientoFacial = await respuesta.json();

      if (!respuesta.ok || !data.ok || !data.reconocido || !data.estudiante) {
        throw new Error(data.message || "No se reconoció el rostro del estudiante");
      }

      setMensaje(`✓ ${data.estudiante.nombres} reconocido. Registrando asistencia...`);
      await ejecutarRegistroAsistencia(
        { dni: data.estudiante.dni, metodo: "FACIAL" },
        foto
      );
    } catch (error: any) {
      setMensaje(`⚠️ ${error.message || "Error en reconocimiento facial"}`);
      setEstadoVisual("error");
      beep("error");
    } finally {
      setReconociendoFacial(false);
    }
  }

  // Pantalla completa
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setEsPantallaCompleta(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setEsPantallaCompleta(false);
    }
  }

  // Bloqueo de terminal
  function bloquearTerminal() {
    localStorage.removeItem("terminal_id");
    localStorage.removeItem("terminal_token");
    detenerCamaraFoto();
    void liberarRecursosCamara();
    setTerminalAutorizado(false);
    setErrorTerminal("");
  }

  async function vincularTerminal(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorTerminal("");
    const tId = terminalIdInput.trim();
    const tToken = terminalTokenInput.trim();

    if (!tId || !tToken) {
      setErrorTerminal("Ingrese el ID de terminal y su Token Secreto.");
      return;
    }

    setValidandoTerminal(true);
    try {
      const res = await fetch("/api/terminales/verificar", {
        headers: {
          "x-terminal-id": tId,
          "x-terminal-token": tToken,
        },
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        localStorage.setItem("terminal_id", tId);
        localStorage.setItem("terminal_token", tToken);
        setTerminalAutorizado(true);
      } else {
        setErrorTerminal(data?.message || "Terminal no autorizada o credenciales inválidas.");
      }
    } catch {
      setErrorTerminal("Error de conexión al verificar terminal.");
    } finally {
      setValidandoTerminal(false);
    }
  }

  // Pantalla de carga
  if (terminalAutorizado === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800 shadow-2xl">
          <span className="animate-spin text-xl">?</span>
          <span className="font-bold text-sm">Verificando autorización de terminal...</span>
        </div>
      </main>
    );
  }

  // Pantalla de activación / vinculación de terminal
  if (terminalAutorizado === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="bg-slate-900 p-8 text-center border-b border-slate-800">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl p-2 shadow-inner flex items-center justify-center">
              <Image
                src={configuracion.logoUrl || "/img/logo-santa-rita.png"}
                alt="Logo"
                width={70}
                height={70}
                className="object-contain w-full h-full"
                priority
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-400/40 mb-2">
              <span>??</span> Terminal Protegido
            </div>
            <h1 className="text-xl font-black text-white">
              {configuracion.nombreColegio || "I.E. Santa Rita de Casia"}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Terminal de Marcación QR Criptográfica
            </p>
          </div>

          <form onSubmit={vincularTerminal} className="p-8 space-y-4">
            {errorTerminal && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                <span>??</span> {errorTerminal}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Identificador de Terminal
              </label>
              <input
                type="text"
                value={terminalIdInput}
                onChange={(e) => setTerminalIdInput(e.target.value)}
                placeholder="Ej. TRM-CASIA-01"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Token Secreto de Terminal
              </label>
              <input
                type="password"
                value={terminalTokenInput}
                onChange={(e) => setTerminalTokenInput(e.target.value)}
                placeholder="sec_..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={validandoTerminal}
              className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <LuShieldCheck className="w-4 h-4" />
              <span>{validandoTerminal ? "Verificando..." : "ACTIVAR TERMINAL"}</span>
            </button>

            <div className="pt-2 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => router.push("/login?retorno=/marcar")}
                className="w-full py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
              >
                Ingresar con Usuario de Personal
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }
  // PANTALLA PRINCIPAL: TERMINAL ESCOLAR V2 PROFESIONAL
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-x-hidden">
      {/* 1. Header Superior Compacto y Tecnológico */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-2.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {/* Identidad y Colegio */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow">
            {configuracion.logoUrl ? (
              <img src={configuracion.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Image src="/img/logo-santa-rita.png" alt="Logo" width={40} height={40} className="object-contain" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide truncate max-w-[140px] sm:max-w-xs">
                {configuracion.nombreColegio}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-400/30">
                V2 Full-Frame
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              🖥️ {configTerminal.nombreTerminal} ({configTerminal.terminalId})
            </p>
          </div>
        </div>

        {/* Selector de Modo Operativo ENTRADA / SALIDA */}
        <div className="inline-flex items-center p-1 bg-slate-950/90 border border-slate-700/80 rounded-2xl shadow-inner">
          <button
            type="button"
            onClick={() => {
              setModoOperativo("ENTRADA");
              setMensaje("Modo ENTRADA activo. Escanee QR de ingreso.");
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
              modoOperativo === "ENTRADA"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/60 ring-2 ring-emerald-400/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ENTRADA</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setModoOperativo("SALIDA");
              setMensaje("Modo SALIDA activo. Escanee QR de salida.");
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
              modoOperativo === "SALIDA"
                ? "bg-blue-600 text-white shadow-md shadow-blue-950/60 ring-2 ring-blue-400/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span>SALIDA</span>
          </button>
        </div>

        {/* Reloj Digital en Vivo y Chips de Estado */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {horaActual && (
            <div className="px-3 py-1 rounded-xl bg-slate-800/90 border border-slate-700/80 font-mono text-xs sm:text-sm font-black text-cyan-300 tracking-wider shadow-inner flex items-center gap-1.5">
              <LuClock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{horaActual}</span>
            </div>
          )}

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ONLINE
          </span>

          <span
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              camaraActiva
                ? "bg-blue-950/90 border-blue-500/40 text-blue-300"
                : "bg-red-950/90 border-red-500/40 text-red-300"
            }`}
          >
            {camaraActiva ? (
              <LuCamera className="w-3.5 h-3.5 text-blue-300" />
            ) : (
              <LuCameraOff className="w-3.5 h-3.5 text-red-300" />
            )}
            <span>{camaraActiva ? `${diagnostico.resolucion} @ ${diagnostico.fps}fps` : "Apagada"}</span>
          </span>

          <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/90 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold">
            <LuScan className="w-3.5 h-3.5 text-indigo-400" />
            <span>Escáner 100% Fotograma</span>
          </span>
        </div>

        {/* Acciones Rápidas del Header */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Guía Visual (Retícula HUD) */}
          <button
            type="button"
            onClick={() => setGuiaVisual(!guiaVisual)}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              guiaVisual
                ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
            }`}
            title={guiaVisual ? "Ocultar retícula de referencia" : "Mostrar retícula de referencia"}
          >
            {guiaVisual ? <FaEye className="text-xs" /> : <FaEyeSlash className="text-xs" />}
            <span className="hidden md:inline">Guía</span>
          </button>

          {/* Ajuste de Video (Contain / Cover) */}
          <button
            type="button"
            onClick={() => setAjusteVideo(ajusteVideo === "contain" ? "cover" : "contain")}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
            title={
              ajusteVideo === "contain"
                ? "Modo actual: Completo (sin recortes). Clic para llenar pantalla"
                : "Modo actual: Llenar pantalla. Clic para modo completo (sin recortes)"
            }
          >
            <FaCrop className="text-xs" />
            <span className="hidden md:inline">{ajusteVideo === "contain" ? "Completo" : "Llenar"}</span>
          </button>

          {/* Girar / Cambiar Cámara */}
          <button
            type="button"
            onClick={() => void girarCamara()}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
            title={
              configTerminal.tipoDispositivo === "LAPTOP_PC"
                ? "Alternar cámara conectada"
                : "Girar entre cámara frontal y trasera"
            }
          >
            <FaSyncAlt className="text-xs" />
            <span className="hidden lg:inline">
              {configTerminal.tipoDispositivo === "LAPTOP_PC" && camaras.length > 1
                ? "Cambiar Cam"
                : "Girar"}
            </span>
          </button>

          {/* Linterna */}
          {soportaLinterna && (
            <button
              type="button"
              onClick={() => void alternarLinterna()}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                linternaActiva
                  ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
              }`}
              title="Encender / Apagar linterna del dispositivo"
            >
              <FaLightbulb className="text-xs" />
              <span className="hidden lg:inline">Luz</span>
            </button>
          )}

          {/* Diagnóstico */}
          <button
            type="button"
            onClick={() => setDiagnosticoAbierto(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold transition flex items-center gap-1"
            title="Diagnóstico técnico del sensor y FPS"
          >
            <LuActivity className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Diag</span>
          </button>

          {/* Configuración */}
          <button
            type="button"
            onClick={() => setPanelConfigAbierto(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center"
            title="Configuración de cámaras y dispositivos"
          >
            <LuSettings className="w-3.5 h-3.5" />
          </button>

          {/* Colapsar Sidebar */}
          <button
            type="button"
            onClick={() => setSidebarColapsado(!sidebarColapsado)}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold transition hidden sm:flex items-center gap-1 ${
              sidebarColapsado
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
            title={sidebarColapsado ? "Mostrar panel lateral" : "Maximizar cámara a toda la pantalla"}
          >
            <LuMaximize2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{sidebarColapsado ? "Panel" : "Ampliar"}</span>
          </button>

          {/* Pantalla Completa */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs"
            title={esPantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {esPantallaCompleta ? <FaCompress /> : <FaExpand />}
          </button>

          {/* Bloquear */}
          <button
            type="button"
            onClick={bloquearTerminal}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition flex items-center justify-center"
            title="Bloquear terminal"
          >
            <LuLock className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Cuerpo Central de la Terminal V2 */}
      <div className="flex-1 w-full max-w-[1920px] mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* Columna Principal de Cámara: 9 de 12 o 12 de 12 si el sidebar está colapsado */}
        <section
          className={`flex flex-col gap-3 transition-all duration-300 ${
            sidebarColapsado ? "lg:col-span-12" : "lg:col-span-8 xl:col-span-9"
          }`}
        >
          {/* Card Principal del Escáner */}
          <div
            className={`relative rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-xl ${
              resultado
                ? "border-emerald-500 ring-4 ring-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.35)]"
                : "border-slate-800"
            }`}
          >
            {/* Header Interno del Escáner */}
            <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-slate-900/95 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  {camaraActiva ? "ESCÁNER QR FULL-FRAME LISTO" : "ESCÁNER QR EN PAUSA"}
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-400 font-semibold">
                  (Detecta en cualquier posición del fotograma)
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {camaraActiva && (
                  <button
                    type="button"
                    onClick={() => void mejorarEnfoque()}
                    disabled={mejorandoEnfoque}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/50 text-xs font-bold transition active:scale-95"
                    title="Calibrar resolución y enfoque"
                  >
                    <span>??</span>
                    <span>{mejorandoEnfoque ? "Calibrando..." : "Enfoque"}</span>
                  </button>
                )}
                <div className="text-xs font-bold text-slate-300">
                  {camaraActiva
                    ? estadoLecturaQR === "detectado"
                      ? "Procesando carnet escolar..."
                      : "Esperando carnet escolar..."
                    : "Cámara en pausa"}
                </div>
              </div>
            </div>

            {/* Viewport del Escáner V2 */}
            <div className="relative w-full min-h-[460px] sm:min-h-[540px] lg:h-[calc(100vh-180px)] bg-black flex items-center justify-center overflow-hidden">
              <style>{`
                #lector-qr {
                  width: 100% !important;
                  height: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  position: relative !important;
                  background-color: #000000 !important;
                }
                #lector-qr video {
                  width: 100% !important;
                  height: 100% !important;
                  max-width: 100% !important;
                  max-height: 100% !important;
                  object-fit: ${ajusteVideo === "cover" ? "cover" : "contain"} !important;
                  display: block !important;
                  margin: 0 auto !important;
                  border-radius: 0.75rem;
                }
                #lector-qr canvas {
                  display: none !important;
                }
                #qr-shaded-region {
                  display: none !important;
                }
              `}</style>

              <div
                id="lector-qr"
                className={`w-full h-full transition-opacity duration-300 ${
                  camaraActiva ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Guía Holográfica Referencial V2 (Opcional, no restringe la lectura) */}
              {camaraActiva && !resultado && guiaVisual && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                  <div className="relative w-[85%] max-w-[560px] h-[75%] max-h-[420px] rounded-3xl border border-cyan-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.15)]">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-2xl"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-2xl"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-2xl"></div>

                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.8)]"></div>

                    <span className="absolute -bottom-5 px-3.5 py-1 rounded-full bg-slate-950/90 border border-cyan-500/40 text-[11px] font-bold text-cyan-200 shadow-xl backdrop-blur-md">
                      Detección activa en toda la pantalla (centro, bordes y esquinas)
                    </span>
                  </div>
                </div>
              )}

              {/* Banner de Bienvenida y Resultado de Marcación Estructurado */}
              {resultado && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/92 backdrop-blur-md animate-in fade-in zoom-in duration-150">
                  {resultado.estudiante ? (
                    <div className={`flex flex-col items-center text-center max-w-lg w-full bg-slate-900/95 border-2 rounded-3xl p-6 sm:p-8 ${
                      resultado.codigoResultado === "ENTRADA_REGISTRADA"
                        ? "border-emerald-500/80 shadow-[0_0_60px_rgba(16,185,129,0.35)]"
                        : resultado.codigoResultado === "SALIDA_REGISTRADA"
                        ? "border-blue-500/80 shadow-[0_0_60px_rgba(59,130,246,0.35)]"
                        : resultado.codigoResultado === "ASISTENCIA_YA_REGISTRADA" || resultado.codigoResultado === "SALIDA_YA_REGISTRADA"
                        ? "border-amber-500/80 shadow-[0_0_60px_rgba(245,158,11,0.35)]"
                        : "border-rose-500/80 shadow-[0_0_60px_rgba(244,63,94,0.35)]"
                    }`}>
                      <div className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-4 bg-slate-800 shadow-2xl mb-4 ${
                        resultado.codigoResultado === "ENTRADA_REGISTRADA"
                          ? "border-emerald-400"
                          : resultado.codigoResultado === "SALIDA_REGISTRADA"
                          ? "border-blue-400"
                          : resultado.codigoResultado === "ASISTENCIA_YA_REGISTRADA" || resultado.codigoResultado === "SALIDA_YA_REGISTRADA"
                          ? "border-amber-400"
                          : "border-rose-400"
                      }`}>
                        {resultado.estudiante.fotoPerfilUrl ? (
                          <img
                            src={resultado.estudiante.fotoPerfilUrl}
                            alt="Estudiante"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">
                            👩‍🎓
                          </div>
                        )}
                      </div>

                      {/* Badge con Semántica de Operación */}
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-2 border ${
                        resultado.codigoResultado === "ENTRADA_REGISTRADA"
                          ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                          : resultado.codigoResultado === "SALIDA_REGISTRADA"
                          ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                          : resultado.codigoResultado === "ASISTENCIA_YA_REGISTRADA"
                          ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                          : resultado.codigoResultado === "SALIDA_YA_REGISTRADA"
                          ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                          : "bg-rose-500/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {resultado.codigoResultado === "ENTRADA_REGISTRADA" ? (
                          <><span>✅</span><span>ENTRADA REGISTRADA</span></>
                        ) : resultado.codigoResultado === "SALIDA_REGISTRADA" ? (
                          <><span>👋</span><span>SALIDA REGISTRADA</span></>
                        ) : resultado.codigoResultado === "ASISTENCIA_YA_REGISTRADA" ? (
                          <><span>⚠️</span><span>ASISTENCIA YA REGISTRADA</span></>
                        ) : resultado.codigoResultado === "SALIDA_YA_REGISTRADA" ? (
                          <><span>⚠️</span><span>SALIDA YA REGISTRADA PREVIAMENTE</span></>
                        ) : (
                          <><span>🚫</span><span>OPERACIÓN FUERA DE HORARIO</span></>
                        )}
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                        {resultado.estudiante.nombres} {resultado.estudiante.apellidos}
                      </h2>

                      <p className="text-sm font-bold text-slate-300 mt-1">
                        {resultado.estudiante.grado} • {resultado.estudiante.seccion}
                      </p>

                      {/* Hora real y persistida garantizada */}
                      <div className="mt-4 px-6 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xl sm:text-2xl font-black">
                        Hora: {resultado.hora || resultado.horaFormateada || (resultado.asistencia as any)?.horaFormateada || (resultado.asistencia as any)?.hora || "--:--"}
                      </div>

                      {resultado.message && (
                        <p className="text-xs text-slate-300 mt-2 max-w-sm font-medium">
                          {resultado.message}
                        </p>
                      )}

                      <p className="text-xs text-slate-400 mt-4 font-bold animate-pulse">
                        Listo para el siguiente estudiante...
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Pantalla cuando la cámara está apagada manualmente */}
              {!camaraActiva && !camaraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-10">
                  <LuCameraOff className="w-16 h-16 mb-3 text-slate-500" />
                  <h3 className="text-2xl font-black text-slate-100">
                    Cámara en Pausa
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">
                    La cámara está apagada. Presione el botón para activar el escaneo permanente.
                  </p>
                  <button
                    type="button"
                    onClick={() => void activarCamaraPermanente()}
                    className="mt-6 inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-white text-base shadow-xl shadow-emerald-950/50 transition transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <LuPlay className="w-5 h-5 mr-1" /> Activar Cámara
                  </button>
                </div>
              )}

              {/* Pantalla de Error de Cámara Profesional */}
              {camaraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 border-2 border-red-500/40 z-10">
                  <LuTriangleAlert className="w-16 h-16 mb-3 text-amber-400" />
                  <h3 className="text-2xl font-black text-white">
                    Aviso de Conexión de Cámara
                  </h3>
                  <p className="text-sm text-red-200 mt-2 max-w-lg font-medium leading-relaxed bg-red-950/60 p-4 rounded-2xl border border-red-800/60">
                    {camaraError}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => void activarCamaraPermanente()}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl transition active:scale-95"
                    >
                      <LuRefreshCw className="w-4 h-4 mr-1.5" /> Reintentar Conexión
                    </button>

                    <button
                      type="button"
                      onClick={() => void cambiarCamaraEnVivo("")}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-xl transition active:scale-95"
                      title="Usar la cámara predeterminada integrada en el equipo"
                    >
                      <LuCamera className="w-4 h-4 mr-1.5" /> Usar Cámara Integrada
                    </button>

                    <button
                      type="button"
                      onClick={() => setPanelConfigAbierto(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm transition"
                    >
                      <LuSlidersHorizontal className="w-4 h-4 mr-1.5" /> Cambiar Dispositivo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Barra Inferior del Viewport: Controles Rápidos y Selector */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {camaraActiva ? (
                  <button
                    type="button"
                    onClick={apagarCamaraManual}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs transition"
                  >
                    <LuPause className="w-3.5 h-3.5 mr-1" /> Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void activarCamaraPermanente()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                  >
                    <LuPlay className="w-3.5 h-3.5 mr-1" /> Activar
                  </button>
                )}

                {soportaZoom && (
                  <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400 font-bold">Zoom:</span>
                    {[1, 1.5, 2]
                      .filter((z) => z <= (rangoZoom.max || 1))
                      .map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => void aplicarZoom(z)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black transition ${
                            nivelZoom === z
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {z}x
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Selector Rápido de Cámara */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-400 shrink-0">
                  Cámara:
                </span>
                <select
                  value={camaraQrSeleccionada}
                  onChange={(e) => void cambiarCamaraEnVivo(e.target.value)}
                  className="w-full sm:w-64 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold focus:border-blue-500 outline-none"
                >
                  <option value="">Predeterminada (HD Automática)</option>
                  {camaras.map((c, i) => (
                    <option key={c.deviceId || i} value={c.deviceId}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>
        {/* Columna Lateral Compacta: DNI, Reconocimiento Facial e Historial */}
        {!sidebarColapsado && (
          <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3">
            {/* Pestañas del Panel Lateral */}
            <div className="flex rounded-2xl bg-slate-900 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => setPestanaSidebar("dni")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  pestanaSidebar === "dni"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FaIdCard />
                <span>DNI</span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaSidebar("facial")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  pestanaSidebar === "facial"
                    ? "bg-violet-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LuScanFace className="w-3.5 h-3.5" />
                <span>Facial</span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaSidebar("historial")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  pestanaSidebar === "historial"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LuClock className="w-3.5 h-3.5" />
                <span>Recientes</span>
              </button>
            </div>

            {/* Contenido Pestaña 1: Marcación Manual por DNI */}
            {pestanaSidebar === "dni" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                    <LuCreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      Marcación por DNI
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Para alumnos sin carnet escolar
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={manejarEnterDni}
                    placeholder="DNI (8 dígitos)"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-lg font-mono font-bold text-center text-white placeholder:text-slate-500 focus:border-emerald-500 outline-none"
                  />

                  <button
                    type="button"
                    onClick={marcarPorDni}
                    disabled={dni.length !== 8}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-xs text-white transition shadow-md"
                  >
                    Registrar Asistencia DNI
                  </button>
                </div>
              </div>
            )}

            {/* Contenido Pestaña 2: Reconocimiento Facial Auxiliar */}
            {pestanaSidebar === "facial" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm">
                    <LuScanFace className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      Reconocimiento Facial
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Identificación biométrica AWS
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={marcarPorRostroAuxiliar}
                  disabled={reconociendoFacial || !camaraActiva}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 font-black text-xs text-white transition shadow-md"
                >
                  {reconociendoFacial ? "Reconociendo rostro..." : "Marcar con Rostro"}
                </button>
              </div>
            )}

            {/* Contenido Pestaña 3: Historial en Vivo de últimas Asistencias */}
            {pestanaSidebar === "historial" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <LuClock className="w-4 h-4 text-blue-400" />
                    <span>Marcaciones Recientes</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    últimas 5
                  </span>
                </div>

                {historialMarcas.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Aún no hay marcaciones en esta sesión.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {historialMarcas.map((marca) => (
                      <div
                        key={marca.id}
                        className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-white truncate max-w-[170px]">
                            {marca.estudiante}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {marca.gradoSeccion}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] block">
                            {marca.hora}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold">
                            {marca.tipo}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tarjeta Informativa Compacta */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400 space-y-1">
              <p className="font-bold text-slate-300 flex items-center gap-1">
                <LuShieldCheck className="w-4 h-4 text-emerald-400 inline mr-1" /> Terminal V2 Escolar
              </p>
              <p>
                Detección perimétrica total sin restricción de encuadre.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL DE DIAGNÓSTICO DE CÁMARA */}
      {diagnosticoAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-cyan-500/40 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <LuActivity className="w-6 h-6" />
                <h3 className="text-lg font-black text-white">
                  Diagnóstico de Cámara del Terminal V2
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiagnosticoAbierto(false)}
                className="p-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-bold text-xs"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">Resolución del Sensor</span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {diagnostico.resolucion}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{diagnostico.estado}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">FPS de Video</span>
                <span className="text-lg font-mono font-black text-cyan-400">
                  {diagnostico.fps} FPS
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Fluidez óptima</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 col-span-2">
                <span className="text-slate-400 font-bold block">Cámara Usada</span>
                <span className="text-sm font-bold text-white block truncate">
                  {diagnostico.camaraLabel}
                </span>
                <span className="text-xs text-blue-400 font-semibold mt-0.5 block">
                  Tipo: {diagnostico.tipoCamara}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">Modo de Enfoque</span>
                <span className="text-sm font-extrabold text-blue-400 block mt-0.5">
                  {diagnostico.focusMode || "Continuo"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Autofocus activo</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">Linterna (Torch)</span>
                <span className="text-sm font-extrabold text-amber-400 block mt-0.5">
                  {soportaLinterna ? (linternaActiva ? "Encendida" : "Disponible") : "No compatible"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Hardware control</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDiagnosticoAbierto(false)}
              className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-xs font-black text-white transition shadow-lg"
            >
              Cerrar Diagnóstico
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIGURACIÓN DE TERMINAL */}
      {panelConfigAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-blue-400">
                <LuSettings className="w-6 h-6" />
                <h3 className="text-lg font-black text-white">
                  Configuración de Terminal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPanelConfigAbierto(false)}
                className="p-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-bold text-xs"
              >
                Cerrar
              </button>
            </div>

            {/* Selector de Cámaras Disponibles */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Cámaras detectadas en el equipo:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => void cambiarCamaraEnVivo("")}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition ${
                    !camaraQrSeleccionada
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LuCamera className="w-4 h-4 text-emerald-400" />
                    <span>Predeterminada del sistema (HD Automática)</span>
                  </div>
                  {!camaraQrSeleccionada && <span className="text-blue-400 shrink-0">✓ Activa</span>}
                </button>

                {camaras.map((cam, idx) => {
                  const esSeleccionada = camaraQrSeleccionada === cam.deviceId;
                  const esVirtual = cam.esVirtual ?? esCamaraVirtual(cam.label);
                  return (
                    <button
                      key={cam.deviceId || idx}
                      type="button"
                      onClick={() => void cambiarCamaraEnVivo(cam.deviceId)}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition ${
                        esSeleccionada
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {esVirtual ? (
                          <LuSlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <LuCamera className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{cam.label}</span>
                        {esVirtual && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold shrink-0">
                            Virtual
                          </span>
                        )}
                      </div>
                      {esSeleccionada && <span className="text-blue-400 shrink-0">✓ Activa</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Perfiles de Dispositivo */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Perfil del Dispositivo:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => void cambiarTipoDispositivoEnVivo("LAPTOP_PC")}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                    configTerminal.tipoDispositivo === "LAPTOP_PC"
                      ? "border-blue-500 bg-blue-600 text-white shadow"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="text-lg">??</span>
                  <span>Laptop / PC</span>
                  <span className="text-[10px] opacity-80">Frontal HD (1280x720)</span>
                </button>

                <button
                  type="button"
                  onClick={() => void cambiarTipoDispositivoEnVivo("TABLET_CELULAR")}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                    configTerminal.tipoDispositivo === "TABLET_CELULAR"
                      ? "border-blue-500 bg-blue-600 text-white shadow"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="text-lg">??</span>
                  <span>Celular / Tablet</span>
                  <span className="text-[10px] opacity-80">
                    {configTerminal.modoCamaraPreferido === "user" ? "Delantera" : "Trasera (Recomendada)"}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPanelConfigAbierto(false)}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white transition shadow-lg shadow-blue-950/40"
            >
              Guardar y Aplicar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
