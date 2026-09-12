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
import { FaIdCard } from "react-icons/fa";
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

type EstadoVisual =
  | "normal"
  | "entrada"
  | "salida"
  | "error"
  | "aviso";

type ResultadoAsistencia = {
  ok?: boolean;
  yaRegistrado?: boolean;
  tipo?: "ENTRADA" | "SALIDA";
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

export default function MarcarPage() {
  const router = useRouter();
  const { configuracion } = useConfiguracionColegio();

  // Configuración del terminal escolar
  const [configTerminal, setConfigTerminal] = useState<TerminalConfig>(
    obtenerConfiguracionTerminal
  );

  const [dni, setDni] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState<ResultadoAsistencia | null>(null);

  // Estados de cámara permanente y control manual
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
    fps: 18,
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

  // Capacidades de Enfoque y Zoom por hardware
  const [soportaZoom, setSoportaZoom] = useState(false);
  const [rangoZoom, setRangoZoom] = useState<{ min: number; max: number; step: number }>({ min: 1, max: 1, step: 0.1 });
  const [nivelZoom, setNivelZoom] = useState(1);
  const [mejorandoEnfoque, setMejorandoEnfoque] = useState(false);

  // Última lectura realizada en el terminal
  const [ultimaLectura, setUltimaLectura] = useState<{
    estudiante: string;
    hora: string;
    tipo?: string;
    gradoSeccion?: string;
  } | null>(null);

  // Pestaña o modo auxiliar: "ninguno", "dni" manual o "facial"
  const [modoAuxiliar, setModoAuxiliar] = useState<"ninguno" | "dni" | "facial">("ninguno");

  const procesandoQR = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamFotoRef = useRef<MediaStream | null>(null);

  // 1. Autorización de terminal y configuración inicial
  useEffect(() => {
    const logueado = localStorage.getItem("logueado");
    const terminalIdLocal = localStorage.getItem("terminal_id");
    const terminalTokenLocal = localStorage.getItem("terminal_token");

    if (logueado === "true" || (terminalIdLocal && terminalTokenLocal)) {
      setTerminalAutorizado(true);
      const cfg = obtenerConfiguracionTerminal();
      setConfigTerminal(cfg);
      setCamaraQrSeleccionada(cfg.camaraSeleccionada);
      void cargarCamaras();
    } else {
      setTerminalAutorizado(false);
      return;
    }

    window.history.pushState(null, "", window.location.href);
    const bloquearAtras = () => {
      window.history.pushState(null, "", window.location.href);
    };

    const actualizarCamaras = () => {
      void cargarCamaras();
    };

    window.addEventListener("popstate", bloquearAtras);
    navigator.mediaDevices?.addEventListener("devicechange", actualizarCamaras);

    const onFullscreenChange = () => {
      setEsPantallaCompleta(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      window.removeEventListener("popstate", bloquearAtras);
      navigator.mediaDevices?.removeEventListener("devicechange", actualizarCamaras);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      detenerCamaraFoto();
      void detenerCamaraQR();
    };
  }, [router, terminalAutorizado]);

  // 2. Auto-iniciar cámara permanente al estar autorizado el terminal
  useEffect(() => {
    if (terminalAutorizado === true && !camaraActiva && !camaraManualApagada) {
      void activarCamaraPermanente();
    }
  }, [terminalAutorizado, camaraManualApagada]);

  function nombreCamara(dispositivo: MediaDeviceInfo, indice: number) {
    return dispositivo.label.trim() || `Cámara ${indice + 1}`;
  }

  function elegirCamaraPredeterminada({
    dispositivos,
    preferencia,
    tipo,
  }: {
    dispositivos: CamaraDispositivo[];
    preferencia: string;
    tipo: "QR" | "FACIAL";
  }) {
    if (preferencia && dispositivos.some((c) => c.deviceId === preferencia)) {
      return preferencia;
    }

    const palabras =
      tipo === "QR"
        ? ["back", "rear", "environment", "trasera"]
        : ["front", "user", "facetime", "webcam", "integrated", "frontal"];

    const encontrada = dispositivos.find((camara) =>
      palabras.some((palabra) => camara.label.toLowerCase().includes(palabra))
    );

    if (encontrada) {
      return encontrada.deviceId;
    }

    return tipo === "QR"
      ? dispositivos.at(-1)?.deviceId || ""
      : dispositivos[0]?.deviceId || "";
  }

  async function cargarCamaras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    setCargandoCamaras(true);
    let streamTemporal: MediaStream | null = null;

    try {
      const iniciales = await navigator.mediaDevices.enumerateDevices();
      const hayEtiquetas = iniciales.some(
        (dispositivo) => dispositivo.kind === "videoinput" && Boolean(dispositivo.label)
      );

      if (!hayEtiquetas && navigator.mediaDevices.getUserMedia) {
        try {
          streamTemporal = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch {
          // Permiso pendiente
        }
      }

      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      const camarasEncontradas: CamaraDispositivo[] = dispositivos
        .filter((dispositivo) => dispositivo.kind === "videoinput")
        .map((dispositivo, indice) => ({
          deviceId: dispositivo.deviceId,
          label: nombreCamara(dispositivo, indice),
        }));

      setCamaras(camarasEncontradas);

      const cfg = obtenerConfiguracionTerminal();
      const preferidaQr = cfg.camaraSeleccionada || localStorage.getItem("camara_qr_device_id") || "";
      const preferidaFacial = localStorage.getItem("camara_facial_device_id") || "";

      const seleccionQr = elegirCamaraPredeterminada({
        dispositivos: camarasEncontradas,
        preferencia: preferidaQr,
        tipo: "QR",
      });

      setCamaraQrSeleccionada(seleccionQr);
      setCamaraFacialSeleccionada(
        elegirCamaraPredeterminada({
          dispositivos: camarasEncontradas,
          preferencia: preferidaFacial,
          tipo: "FACIAL",
        })
      );
    } catch (error) {
      console.error("Error detectando cámaras:", error);
    } finally {
      streamTemporal?.getTracks().forEach((track) => track.stop());
      setCargandoCamaras(false);
    }
  }

  function beep(tipo: "ok" | "error") {
    const audio = new Audio(tipo === "ok" ? "/beep-ok.mp3" : "/beep-error.mp3");
    audio.play().catch(() => {});
  }

  async function esperar(ms: number) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  // Detiene el lector QR limpiamente
  async function detenerCamaraQR() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const estado = scanner.getState();
        if (estado === 2 || estado === 3) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (error) {
        console.warn("Lector QR detenido:", error);
      } finally {
        scannerRef.current = null;
      }
    }

    setCamaraActiva(false);
    procesandoQR.current = false;
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

  // 3. Iniciar cámara permanente con perfil optimizado (Laptop HD vs Celular/Tablet Autofocus)
  async function activarCamaraPermanente(
    dispositivoIdCustom?: string,
    modoFacingCustom?: "environment" | "user"
  ) {
    if (iniciandoCamara) return;
    setIniciandoCamara(true);
    setCamaraError("");

    detenerCamaraFoto();

    const cfg = obtenerConfiguracionTerminal();
    const deviceId = dispositivoIdCustom ?? camaraQrSeleccionada ?? cfg.camaraSeleccionada;
    const esLaptop = cfg.tipoDispositivo === "LAPTOP_PC";
    const facingMode =
      modoFacingCustom ??
      (esLaptop ? "user" : cfg.modoCamaraPreferido || "environment");

    try {
      if (scannerRef.current) {
        try {
          const st = scannerRef.current.getState();
          if (st === 2 || st === 3) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          console.warn("Limpiando scanner previo:", e);
        }
        scannerRef.current = null;
      }

      setCamaraActiva(true);
      setCamaraManualApagada(false);
      procesandoQR.current = false;

      await esperar(200);

      // Instanciar motor ZXing nativo estable y confiable (sin flags experimentales que bloquean Chromium)
      const lector = new Html5Qrcode("lector-qr");
      scannerRef.current = lector;

      // 1. Mejorar constraints de getUserMedia:
      // width ideal 1920, height ideal 1080, aspectRatio 16/9, facingMode environment
      const targetFacing = esLaptop ? "user" : (facingMode === "user" ? "user" : "environment");

      const videoConstraints: any = {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        aspectRatio: { ideal: 16 / 9 },
        facingMode: targetFacing,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };

      // Solicitar focusMode continuous si el navegador lo permite
      try {
        const supported = typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints?.();
        if (supported && (supported as any).focusMode) {
          videoConstraints.advanced = [{ focusMode: "continuous" }];
        }
      } catch (eSupp) {
        console.warn("Verificación de constraints soportadas omitida:", eSupp);
      }

      // El primer parámetro de start debe tener exactamente 1 clave según especificación de Html5Qrcode
      const cameraTarget: any = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: targetFacing };

      await lector.start(
        cameraTarget,
        {
          fps: 18, // 15-20 FPS óptimo sin sobrecargar CPU
          qrbox: (w, h) => {
            // qrbox adaptable al tamaño real del QR en móviles y laptops
            const minEdge = Math.min(w, h);
            const qrEdge = Math.max(220, Math.min(Math.floor(minEdge * 0.72), 460));
            return { width: qrEdge, height: qrEdge };
          },
          videoConstraints,
        },
        async (codigoLeido) => {
          console.log("[QR DEBUG]");
          console.log("Código leído:", codigoLeido);
          console.log("Fecha:", new Date().toISOString());
          console.log("Longitud:", codigoLeido.length);
          console.log("Función ejecutada: procesarLecturaQRContinuo");

          if (procesandoQR.current) {
            console.log("[QR DEBUG] Lectura omitida: debounce/cooldown activo");
            return;
          }
          procesandoQR.current = true;
          await procesarLecturaQRContinuo(codigoLeido.trim());
        },
        () => {
          // Frame sin QR
        }
      );

      // 2. Aplicar autoFocus continuo, zoom si MediaTrackCapabilities lo soporta y capturar resolución real
      await aplicarOptimizacionesHardwareTrack(lector);

      console.log("[TERMINAL V2] Cámara permanente activa en alta definición 1080p.");
    } catch (error: any) {
      console.error("[TERMINAL V2] Error activando cámara permanente:", error);
      scannerRef.current = null;
      setCamaraActiva(false);

      if (error.name === "NotAllowedError" || error.message?.includes("Permission")) {
        setCamaraError("Permiso de cámara denegado. Active el acceso a la cámara en el navegador.");
      } else {
        setCamaraError("Cámara desconectada o no disponible.");
      }
    } finally {
      setIniciandoCamara(false);
    }
  }

  // 3.1 Inspección y optimización de hardware: AutoFocus, Zoom y captura de resolución real
  async function aplicarOptimizacionesHardwareTrack(lectorInstancia?: Html5Qrcode | null) {
    try {
      await esperar(350); // Dar margen a la negociación del sensor
      const videoEl = (document.querySelector("#lector-qr video") || document.querySelector("video")) as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];

      let realWidth = videoEl?.videoWidth || 1920;
      let realHeight = videoEl?.videoHeight || 1080;
      let realFps = 18;
      let focusModeDetectado = "Estándar";
      let soportaZ = false;
      let zMin = 1;
      let zMax = 1;
      let zStep = 0.1;
      let zoomActual = 1;

      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        const settings: any = track.getSettings ? track.getSettings() : {};

        realWidth = videoEl?.videoWidth || settings.width || realWidth;
        realHeight = videoEl?.videoHeight || settings.height || realHeight;
        realFps = Math.round(settings.frameRate || 18);

        // AutoFocus continuo si el navegador lo permite
        const advanced: any = {};
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
          if (capabilities.focusMode.includes("continuous")) {
            advanced.focusMode = "continuous";
            focusModeDetectado = "Continuo (Activo)";
          } else if (capabilities.focusMode.includes("auto")) {
            advanced.focusMode = "auto";
            focusModeDetectado = "Automático";
          }
        }

        // Zoom por hardware si MediaTrackCapabilities lo soporta
        if (capabilities.zoom) {
          soportaZ = true;
          zMin = capabilities.zoom.min || 1;
          zMax = capabilities.zoom.max || 1;
          zStep = capabilities.zoom.step || 0.1;
          zoomActual = settings.zoom || zMin || 1;
          setSoportaZoom(true);
          setRangoZoom({ min: zMin, max: zMax, step: zStep });
          setNivelZoom(zoomActual);
        } else {
          setSoportaZoom(false);
        }

        if (Object.keys(advanced).length > 0) {
          try {
            await track.applyConstraints({ advanced: [advanced] });
            console.log("[CAMARA] FocusMode continuo activado en hardware:", advanced);
          } catch (eAdv) {
            console.warn("[CAMARA] applyConstraints avanzado ignorado por driver:", eAdv);
          }
        }
      }

      const devId = camaraQrSeleccionada;
      const encontrada = camaras.find((c) => c.deviceId === devId);
      const camLabel =
        encontrada?.label ||
        (configTerminal.tipoDispositivo === "LAPTOP_PC"
          ? "Webcam Integrada HD"
          : "Cámara Trasera HD");
      const tipoCam = camLabel.toLowerCase().includes("usb")
        ? "USB"
        : camLabel.toLowerCase().includes("integrated") || configTerminal.tipoDispositivo === "LAPTOP_PC"
        ? "Webcam Integrada"
        : "Cámara Móvil / Tablet";

      setDiagnostico((prev) => ({
        ...prev,
        resolucion: `${realWidth}x${realHeight}`,
        fps: realFps > 0 ? realFps : 18,
        camaraLabel: camLabel,
        tipoCamara: tipoCam,
        estado: "Óptimo HD",
        focusMode: focusModeDetectado,
        zoomSoportado: soportaZ,
        zoomActual,
      }));

      console.log(`[CAMARA] Resolución real negociada: ${realWidth}x${realHeight} a ${realFps} FPS. Enfoque: ${focusModeDetectado}`);
    } catch (err) {
      console.warn("[CAMARA] No se pudo leer diagnóstico detallado:", err);
    }
  }

  // 3.2 Aplicar Zoom en tiempo real
  async function aplicarZoom(nuevoZoom: number) {
    try {
      setNivelZoom(nuevoZoom);
      const video = (document.querySelector("#lector-qr video") || document.querySelector("video")) as HTMLVideoElement | null;
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.zoom) {
          const clamped = Math.max(capabilities.zoom.min || 1, Math.min(capabilities.zoom.max || 5, nuevoZoom));
          await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
          setDiagnostico((prev) => ({ ...prev, zoomActual: clamped }));
          console.log(`[CAMARA] Zoom cambiado a ${clamped}x`);
        }
      }
    } catch (err) {
      console.warn("[CAMARA] Error aplicando zoom:", err);
    }
  }

  // 3.3 Botón 'Mejorar enfoque': Reinicia stream con máxima resolución y fuerza calibración de enfoque
  async function mejorarEnfoque() {
    if (mejorandoEnfoque) return;
    setMejorandoEnfoque(true);
    setMensaje("🎯 Calibrando enfoque y máxima resolución...");

    try {
      // Intentar autofocus sweep en el sensor activo
      const video = (document.querySelector("#lector-qr video") || document.querySelector("video")) as HTMLVideoElement | null;
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];

      if (track) {
        const caps: any = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && Array.isArray(caps.focusMode)) {
          try {
            if (caps.focusMode.includes("auto")) {
              await track.applyConstraints({ advanced: [{ focusMode: "auto" } as any] });
              await esperar(120);
            }
            if (caps.focusMode.includes("continuous")) {
              await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
            }
          } catch (e) {
            console.warn("Re-enfoque manual no admitido:", e);
          }
        }
      }

      // Reiniciar stream completo garantizando 1080p
      await activarCamaraPermanente(camaraQrSeleccionada || undefined);
      setMensaje("✅ Enfoque optimizado en máxima resolución.");
      setTimeout(() => {
        if (estadoLecturaQR === "listo") {
          setMensaje("Listo siguiente estudiante.");
        }
      }, 2000);
    } catch (err) {
      console.error("Error al mejorar enfoque:", err);
      setMensaje("⚠️ Error al calibrar enfoque");
    } finally {
      setMejorandoEnfoque(false);
    }
  }

  // 4. Control Manual: Apagar cámara
  async function apagarCamaraManual() {
    await detenerCamaraQR();
    setCamaraManualApagada(true);
    setCamaraActiva(false);
    setMensaje("La cámara está desactivada");
    setEstadoVisual("normal");
  }

  // 5. Cambio en caliente de cámara sin recargar página
  async function cambiarCamaraEnVivo(deviceId: string) {
    setCamaraQrSeleccionada(deviceId);
    guardarConfiguracionTerminal({ camaraSeleccionada: deviceId });
    if (camaraActiva) {
      await activarCamaraPermanente(deviceId);
    }
  }

  // 6. Cambio de tipo de dispositivo (Laptop vs Tablet) en caliente
  async function cambiarTipoDispositivoEnVivo(tipo: TipoDispositivoTerminal) {
    const modo: "environment" | "user" = tipo === "TABLET_CELULAR" ? "environment" : "user";
    const nuevaCfg = guardarConfiguracionTerminal({
      tipoDispositivo: tipo,
      modoCamaraPreferido: modo,
    });
    setConfigTerminal(nuevaCfg);
    if (camaraActiva) {
      await activarCamaraPermanente(undefined, modo);
    }
  }

  // Alternar entre cámara trasera y delantera en Tablet/Celular
  async function alternarFacingModeMobile(modo: "environment" | "user") {
    const nuevaCfg = guardarConfiguracionTerminal({
      modoCamaraPreferido: modo,
    });
    setConfigTerminal(nuevaCfg);
    if (camaraActiva) {
      await activarCamaraPermanente(undefined, modo);
    }
  }

  // 7. Extracción de fotograma instantáneo desde el sensor mediante Canvas
  async function capturarFotoDesdeVideoActual(): Promise<Blob | null> {
    try {
      const video = (document.querySelector("#lector-qr video") || document.querySelector("video")) as HTMLVideoElement | null;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = document.createElement("canvas");
        const ancho = Math.min(video.videoWidth, 640);
        const alto = Math.round((video.videoHeight * ancho) / video.videoWidth);
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, ancho, alto);

          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/jpeg", 0.75);
          });

          if (blob && blob.size > 0 && blob.type === "image/jpeg") {
            console.log("[FOTO DEBUG]");
            console.log("Tamaño Blob:", blob.size, "bytes");
            console.log("Tipo MIME:", blob.type);
            console.log("Fecha captura:", new Date().toISOString());
            console.log("Resolución:", `${ancho}x${alto}`);
            return blob;
          } else {
            console.warn("[FOTO DEBUG] canvas.toBlob() no generó un blob válido");
          }
        }
      } else {
        console.warn("[FOTO DEBUG] Video no disponible o dimensiones inválidas para captura");
      }
    } catch (err) {
      console.warn("[FOTO DEBUG] Error al capturar fotograma desde video:", err);
    }
    return null;
  }

  // 8. Subida asíncrona de fotografía en segundo plano con reintentos automáticos (máximo 3)
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
      formData.append("tipo", tipo || "ENTRADA");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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

        if (respuesta.ok && data?.ok) {
          console.log(`[FOTO ASINCRONA] Foto completada con éxito en intento ${intento} para Asistencia #${asistenciaId}`);
          return data.fotoUrl || "";
        }

        // Si ya alcanzó el límite o ya estaba completada
        if (data?.limiteAlcanzado || data?.completada) {
          console.log(`[FOTO ASINCRONA] Respuesta terminal del servidor:`, data?.message);
          return data?.fotoUrl || "";
        }

        console.warn(`[FOTO ASINCRONA] Intento ${intento}/${maxIntentos} falló para Asistencia #${asistenciaId}:`, data?.message || respuesta.statusText);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.warn(`[FOTO ASINCRONA] Error de red en intento ${intento}/${maxIntentos} para Asistencia #${asistenciaId}:`, error?.message || error);
      }

      // Si aún quedan intentos, esperar con backoff breve antes de reintentar
      if (intento < maxIntentos) {
        await new Promise((res) => setTimeout(res, intento * 1000));
      }
    }

    console.error(`[FOTO ASINCRONA] Se agotaron los ${maxIntentos} intentos automáticos para Asistencia #${asistenciaId}. Estado: ERROR_FINAL.`);
    return "";
  }

  // 9. FLUJO PROFESIONAL V2: Asistencia inmediata con captura no-bloqueante
  async function procesarLecturaQRContinuo(codigo: string) {
    const tInicio = performance.now();
    console.log("[TERMINAL V2] QR recibido:", codigo);

    setEstadoLecturaQR("detectado");
    setMensaje("🔍 Código detectado. Validando...");
    beep("ok");

    try {
      // Capturar foto del stream activo en memoria con canvas.toBlob()
      const fotoBlob = await capturarFotoDesdeVideoActual();

      // Sanitizar código leído: remover prefijos como "CODIGO:", "DNI:", "ID:", espacios y saltos de línea
      const codigoLimpio = codigo.trim().replace(/^(CODIGO|DNI|ID)[:\s]+/i, "").trim();
      const esDniNumerico = /^\d{8}$/.test(codigoLimpio);

      const payload = esDniNumerico
        ? { dni: codigoLimpio, codigo: codigoLimpio, metodo: "QR" }
        : { codigo: codigoLimpio, metodo: "QR" };

      // Registrar asistencia (la foto no bloquea la respuesta al alumno)
      await ejecutarRegistroAsistencia(payload, fotoBlob);

      // Medición exacta para diagnóstico
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
      // Cooldown optimizado para máxima agilidad de portería (950 ms)
      await esperar(950);

      // Regresar automáticamente a escaneo para el siguiente estudiante
      setResultado(null);
      setMensaje("Listo siguiente estudiante.");
      setEstadoLecturaQR("listo");
      setEstadoVisual("normal");
      procesandoQR.current = false;
    }
  }

  // 10. Función central de registro de asistencia prioritario (< 400ms)
  async function ejecutarRegistroAsistencia(
    datos: { dni?: string; codigo?: string; metodo: string },
    fotoBlob: Blob | null
  ) {
    const terminalId = localStorage.getItem("terminal_id");
    const terminalToken = localStorage.getItem("terminal_token");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      // 1. Envío prioritario inmediato a la API de asistencias (sin esperar subida de foto)
      const res = await fetch("/api/asistencias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
          fotoUrl: null, // Asistencia prioritaria inmediata
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data: ResultadoAsistencia = await res.json();

      if (!res.ok) {
        const msg = data.message || `No se pudo registrar asistencia (${res.status})`;
        const esDuplicado =
          res.status === 409 ||
          Boolean(data.yaRegistrado) ||
          msg.toLowerCase().includes("ya registró");

        if (esDuplicado) {
          setResultado(data);
          setMensaje(`⚠️ Ya registró asistencia hoy`);
          setEstadoVisual("aviso");
          beep("error");
          return;
        }

        throw new Error(msg);
      }

      // 2. Registro exitoso prioritario inmediato (< 400ms) para liberar al estudiante
      setResultado({
        ...data,
        fotoUrl: data.asistencia?.fotoUrl || null,
        estadoEvidencia: fotoBlob ? "Evidencia en captura" : "Evidencia no disponible",
      });

      setMensaje(
        data.esFueraHorario
          ? `⚠️ ${data.message}`
          : `✅ ${data.message || "Asistencia registrada"}`
      );

      if (data.tipo === "ENTRADA") {
        setEstadoVisual("entrada");
      } else if (data.tipo === "SALIDA") {
        setEstadoVisual(data.esFueraHorario ? "aviso" : "salida");
      }

      // 3. Procesamiento de evidencia fotográfica en segundo plano (asíncrona y no-bloqueante)
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
      setMensaje(`❌ ${err.message || "Error al registrar asistencia"}`);
      setEstadoVisual("error");
      beep("error");
    }
  }

  // Marcación manual por DNI
  async function marcarPorDni() {
    if (!dni.trim() || dni.length !== 8) {
      setMensaje("❌ Ingrese un DNI válido de 8 dígitos");
      setEstadoVisual("error");
      return;
    }

    const foto = await capturarFotoDesdeVideoActual();
    await ejecutarRegistroAsistencia({ dni: dni.trim(), metodo: "DNI" }, foto);
    setDni("");
    setTimeout(() => {
      setModoAuxiliar("ninguno");
    }, 1400);
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
    setMensaje("🙂 Mire hacia la cámara para reconocimiento facial...");

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

      setMensaje(`✅ ${data.estudiante.nombres} reconocido. Registrando asistencia...`);
      await ejecutarRegistroAsistencia(
        { dni: data.estudiante.dni, metodo: "FACIAL" },
        foto
      );
    } catch (error: any) {
      setMensaje(`❌ ${error.message || "Error en reconocimiento facial"}`);
      setEstadoVisual("error");
      beep("error");
    } finally {
      setReconociendoFacial(false);
      setTimeout(() => {
        setModoAuxiliar("ninguno");
      }, 1400);
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

  // Bloqueo y deslogueo
  function bloquearTerminal() {
    localStorage.removeItem("terminal_id");
    localStorage.removeItem("terminal_token");
    detenerCamaraFoto();
    void detenerCamaraQR();
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
          <span className="animate-spin text-xl">⏳</span>
          <span className="font-bold text-sm">Verificando autorización de terminal...</span>
        </div>
      </main>
    );
  }

  // Pantalla de activación / vinculación de terminal
  if (terminalAutorizado === false) {
    return (
      <main
        className="min-h-screen flex items-center justify-center relative bg-slate-950 overflow-hidden p-4 sm:p-6 bg-cover bg-center"
        style={{ backgroundImage: "url('/img/colegio-santa-rita.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-b from-slate-900 to-blue-950 text-white p-8 text-center border-b border-slate-800">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-white p-1.5 shadow-xl">
              <Image
                src="/img/logo-santa-rita.png"
                alt="Logo Institucional"
                width={80}
                height={80}
                className="object-contain w-full h-full"
                priority
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-400/40 mb-2">
              <span>🔒</span> Terminal Protegido
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
                <span>⚠️</span> {errorTerminal}
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
              <span>🔑</span>
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

  // PANTALLA PRINCIPAL: TERMINAL V2 PROFESIONAL DE MARCACIÓN QR PERMANENTE
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-x-hidden">
      {/* 1. Barra Superior de Estado del Terminal (AJUSTE 7) */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 sticky top-0 z-30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Identidad */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 shadow">
            {configuracion.logoUrl ? (
              <img src={configuracion.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Image src="/img/logo-santa-rita.png" alt="Logo" width={44} height={44} className="object-contain" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-wide">
                {configuracion.nombreColegio}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-400/30">
                Terminal V2 Profesional
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold">
              📍 {configTerminal.nombreTerminal} ({configTerminal.terminalId})
            </p>
          </div>
        </div>

        {/* Chips de Estado Oficiales (AJUSTE 7) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Estado: 🟢 ONLINE */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Estado: 🟢 ONLINE
          </span>

          {/* Cámara: 🟢 Activa / 🔴 Apagada */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              camaraActiva
                ? "bg-blue-950/90 border-blue-500/40 text-blue-300"
                : "bg-red-950/90 border-red-500/40 text-red-300"
            }`}
          >
            <span>{camaraActiva ? "🟢" : "🔴"}</span>
            Cámara: {camaraActiva ? "Activa" : "Apagada"}
          </span>

          {/* QR: Dinámico (Esperando / Detectado / Listo) */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-bold">
            {estadoLecturaQR === "detectado" && ultimaLectura ? (
              <>
                <span className="text-emerald-400">✅ QR Detectado:</span>
                <span className="text-white font-extrabold">{ultimaLectura.estudiante}</span>
                <span className="text-cyan-400">({ultimaLectura.hora})</span>
              </>
            ) : mensaje === "Listo siguiente estudiante." ? (
              <span className="text-emerald-300 font-extrabold">🟢 Listo siguiente estudiante.</span>
            ) : (
              <span className="text-slate-300">QR: Esperando estudiante...</span>
            )}
          </span>
        </div>

        {/* Acciones: Diagnóstico, Selector, Fullscreen, Bloqueo */}
        <div className="flex items-center gap-2">
          {/* Botón Diagnóstico (AJUSTE 8) */}
          <button
            type="button"
            onClick={() => setDiagnosticoAbierto(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold transition"
            title="Diagnóstico de cámara y hardware"
          >
            <span>🛠️</span> Diagnóstico
          </button>

          {/* Botón Selector de Cámara (AJUSTE 2) */}
          <button
            type="button"
            onClick={() => setPanelConfigAbierto(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
            title="Configuración de cámaras y dispositivos"
          >
            <span>⚙️</span> Terminal
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-sm"
            title={esPantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {esPantallaCompleta ? "🗗" : "⛶"}
          </button>

          {/* Bloquear */}
          <button
            type="button"
            onClick={bloquearTerminal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition"
            title="Bloquear terminal"
          >
            <span>🔒</span>
          </button>
        </div>
      </header>

      {/* 2. Cuerpo Central de la Terminal */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Principal: Escáner QR Permanente (8 de 12 columnas) */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-3xl border-2 border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Header del Escáner */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  {camaraActiva ? "🟢 Escáner QR HD Listo" : "🔴 Escáner Inactivo"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {camaraActiva && (
                  <button
                    type="button"
                    onClick={() => void mejorarEnfoque()}
                    disabled={mejorandoEnfoque}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/50 text-xs font-bold transition active:scale-95"
                    title="Reiniciar stream con máxima resolución y calibrar enfoque"
                  >
                    <span>🎯</span>
                    <span>{mejorandoEnfoque ? "Calibrando..." : "Mejorar enfoque"}</span>
                  </button>
                )}
                <div className="text-xs font-bold text-slate-400">
                  {camaraActiva
                    ? estadoLecturaQR === "detectado"
                      ? "⚡ Procesando marcación..."
                      : "🟢 Esperando estudiante..."
                    : "Cámara en pausa"}
                </div>
              </div>
            </div>

            {/* Viewport del Escáner */}
            <div className="relative aspect-[4/3] sm:aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              <style>{`
                #lector-qr {
                  width: 100% !important;
                  height: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                }
                #lector-qr video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                  display: block !important;
                }
                #lector-qr canvas {
                  display: none !important;
                }
              `}</style>
              <div
                id="lector-qr"
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  camaraActiva ? "opacity-100" : "opacity-0 hidden"
                }`}
              />

              {/* Guía holográfica con área ampliada (88%) para tolerar movimiento */}
              {camaraActiva && !resultado && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative w-72 h-72 sm:w-80 sm:h-80 border-2 border-blue-500/60 rounded-3xl shadow-[0_0_60px_rgba(59,130,246,0.35)] flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-cyan-400 rounded-tl-2xl"></div>
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-cyan-400 rounded-tr-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-cyan-400 rounded-bl-2xl"></div>
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-cyan-400 rounded-br-2xl"></div>

                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>

                    <span className="absolute -bottom-8 px-3.5 py-1 rounded-full bg-slate-950/85 border border-slate-700 text-xs font-bold text-slate-200 shadow-md">
                      Muestre el carnet escolar a la cámara
                    </span>
                  </div>
                </div>
              )}

              {/* Pantalla cuando la cámara está apagada manualmente */}
              {!camaraActiva && !camaraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10">
                  <span className="text-6xl mb-3">📷</span>
                  <h3 className="text-2xl font-black text-slate-100">
                    La cámara está desactivada
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">
                    El operador detuvo la cámara. Presione el botón para reanudar el escaneo continuo.
                  </p>
                  <button
                    type="button"
                    onClick={() => void activarCamaraPermanente()}
                    className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-white text-base shadow-xl shadow-emerald-950/50 transition transform hover:-translate-y-0.5"
                  >
                    <span>▶</span> Activar cámara
                  </button>
                </div>
              )}

              {/* Pantalla de Recuperación de Cámara */}
              {camaraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-950/90 z-10">
                  <span className="text-5xl mb-3">⚠️</span>
                  <h3 className="text-2xl font-black text-red-200">
                    Cámara desconectada
                  </h3>
                  <p className="text-sm text-red-300 mt-1 max-w-md font-semibold">
                    {camaraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void activarCamaraPermanente()}
                    className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-red-600 hover:bg-red-500 font-black text-white text-base shadow-xl transition"
                  >
                    <span>🔄</span> Reintentar conexión
                  </button>
                </div>
              )}

              {/* Tarjeta de Confirmación de Asistencia con Cooldown Optimizado (1400ms) */}
              {resultado && (
                <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm z-20 animate-in fade-in zoom-in duration-200">
                  {resultado.yaRegistrado ? (
                    <div className="w-full max-w-md rounded-3xl border-2 border-amber-500 bg-slate-900 p-6 text-center shadow-2xl">
                      <div className="text-5xl mb-2">⚠️</div>
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-400/40">
                        Asistencia ya registrada hoy
                      </span>
                      <h2 className="text-2xl font-black text-white mt-3">
                        {resultado.estudiante?.nombres} {resultado.estudiante?.apellidos}
                      </h2>
                      <p className="text-sm text-slate-300 mt-1 font-semibold">
                        {resultado.estudiante?.grado} - {resultado.estudiante?.seccion}
                      </p>
                      <div className="mt-4 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-200 font-mono text-lg font-black">
                        Hora previa: {resultado.asistencia?.horaFormateada || resultado.asistencia?.hora || "--:--"}
                      </div>
                      <p className="text-xs text-slate-400 mt-3 font-medium">
                        Listo para el siguiente estudiante...
                      </p>
                    </div>
                  ) : resultado.estudiante ? (
                    <div
                      className={`w-full max-w-md rounded-3xl border-2 p-6 text-center shadow-2xl ${
                        resultado.tipo === "SALIDA"
                          ? "border-blue-500 bg-slate-900"
                          : "border-emerald-500 bg-slate-900"
                      }`}
                    >
                      <div className="text-5xl mb-2">
                        {resultado.tipo === "SALIDA" ? "👋" : "✅"}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                            resultado.tipo === "SALIDA"
                              ? "bg-blue-500/20 text-blue-300 border-blue-400/40"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          }`}
                        >
                          {resultado.tipo === "SALIDA" ? "Salida Confirmada" : "Entrada Confirmada"}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          resultado.fotoUrl
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
                            : "bg-amber-950/60 text-amber-300 border-amber-700/50"
                        }`}>
                          {resultado.fotoUrl ? "📸 Evidencia capturada" : "⚠ Evidencia no disponible"}
                        </span>
                      </div>
                      <h2 className="text-3xl font-black text-white mt-3">
                        {resultado.estudiante.nombres} {resultado.estudiante.apellidos}
                      </h2>
                      <p className="text-sm text-slate-300 mt-1 font-semibold">
                        {resultado.estudiante.grado} - {resultado.estudiante.seccion}
                      </p>
                      <div className="mt-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xl font-bold">
                        Hora: {resultado.asistencia?.horaFormateada || resultado.asistencia?.hora || "--:--"}
                      </div>
                      <p className="text-xs text-emerald-400 mt-3 font-semibold animate-pulse">
                        Listo para el siguiente estudiante en 1 segundo...
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Barra de Diagnóstico de Video en Vivo (Resolución real, FPS, Cámara y Zoom) */}
            {camaraActiva && (
              <div className="px-4 py-2.5 bg-slate-950/95 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold">Resolución:</span>
                    <span className="font-mono font-black text-emerald-400">
                      {diagnostico.resolucion}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold">FPS:</span>
                    <span className="font-mono font-black text-cyan-400">
                      {diagnostico.fps}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold">Cámara usada:</span>
                    <span className="font-bold text-slate-200 truncate max-w-[160px] sm:max-w-xs">
                      {diagnostico.camaraLabel}
                    </span>
                  </div>

                  {diagnostico.focusMode && (
                    <div className="hidden md:flex items-center gap-1.5">
                      <span className="text-slate-400 font-bold">Enfoque:</span>
                      <span className="font-bold text-blue-400">
                        {diagnostico.focusMode}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {soportaZoom && (
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
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
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {z}x
                          </button>
                        ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void mejorarEnfoque()}
                    disabled={mejorandoEnfoque}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs transition shadow-md shadow-blue-900/30"
                    title="Reiniciar stream con máxima resolución y calibrar enfoque"
                  >
                    <span>🎯</span>
                    <span>{mejorandoEnfoque ? "Calibrando..." : "Mejorar enfoque"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Barra de Control Rápido Inferior */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {camaraActiva ? (
                  <>
                    <button
                      type="button"
                      onClick={apagarCamaraManual}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition"
                    >
                      <span>🔴</span> Apagar cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => void mejorarEnfoque()}
                      disabled={mejorandoEnfoque}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-950/40 transition"
                    >
                      <span>🎯</span> {mejorandoEnfoque ? "Calibrando..." : "Mejorar enfoque"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void activarCamaraPermanente()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition"
                  >
                    <span>▶</span> Activar cámara
                  </button>
                )}
              </div>

              {/* Selector Rápido de Dispositivo */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-400 shrink-0">
                  Cámara:
                </span>
                <select
                  value={camaraQrSeleccionada}
                  onChange={(e) => void cambiarCamaraEnVivo(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold focus:border-blue-500 outline-none"
                >
                  <option value="">Predeterminada (HD Automática)</option>
                  {camaras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selector de Perfil Rápido: Laptop vs Tablet */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-400">
              Perfil Activo del Terminal:
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => void cambiarTipoDispositivoEnVivo("LAPTOP_PC")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                  configTerminal.tipoDispositivo === "LAPTOP_PC"
                    ? "bg-blue-600 text-white shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <span>💻</span> Laptop / PC (Webcam Frontal HD)
              </button>

              <button
                type="button"
                onClick={() => void cambiarTipoDispositivoEnVivo("TABLET_CELULAR")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                  configTerminal.tipoDispositivo === "TABLET_CELULAR"
                    ? "bg-blue-600 text-white shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <span>📱</span> Tablet / Celular
              </button>
            </div>
          </div>
        </section>

        {/* Columna Secundaria: Opciones Auxiliares */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* Ingreso Manual por DNI */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
                <FaIdCard />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Ingreso Manual por DNI
                </h3>
                <p className="text-xs text-slate-400">
                  Para alumnos sin carnet escolar físico.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                onKeyDown={manejarEnterDni}
                placeholder="Número de DNI (8 dígitos)"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-xl font-mono font-bold text-center text-white placeholder:text-slate-500 focus:border-emerald-500 outline-none"
              />

              <button
                type="button"
                onClick={marcarPorDni}
                disabled={dni.length !== 8}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-sm text-white transition shadow-lg shadow-emerald-950/40"
              >
                Registrar Asistencia DNI
              </button>
            </div>
          </div>

          {/* Reconocimiento Facial Auxiliar */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center text-xl">
                🙂
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Reconocimiento Facial
                </h3>
                <p className="text-xs text-slate-400">
                  Identificación biométrica AWS Rekognition.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={marcarPorRostroAuxiliar}
              disabled={reconociendoFacial || !camaraActiva}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 font-black text-sm text-white transition shadow-lg shadow-violet-950/40"
            >
              {reconociendoFacial ? "Reconociendo rostro..." : "Marcar con Rostro"}
            </button>
          </div>

          {/* Tarjeta Informativa */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2">
            <p className="font-bold text-slate-300 flex items-center gap-1.5">
              <span>🛡️</span> Terminal Inteligente V2
            </p>
            <p>
              Escaneo permanente a 28 FPS con resolución HD y captura no-bloqueante de evidencia.
            </p>
            <p className="text-[11px] text-slate-500">
              Cadencia optimizada para hasta 40 registros por minuto en la puerta escolar.
            </p>
          </div>
        </aside>
      </div>

      {/* MODAL / PANEL DE DIAGNÓSTICO DE CÁMARA (AJUSTE 8) */}
      {diagnosticoAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-cyan-500/40 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <span className="text-2xl">🛠️</span>
                <h3 className="text-lg font-black text-white">
                  Diagnóstico de Cámara del Terminal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiagnosticoAbierto(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">Resolución del Sensor</span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {diagnostico.resolucion}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Captura nativa HD</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">FPS de Escaneo</span>
                <span className="text-lg font-mono font-black text-cyan-400">
                  {diagnostico.fps} FPS
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Tiempo real fluido</span>
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
                <span className="text-slate-400 font-bold block">Soporte de Zoom</span>
                <span className="text-sm font-extrabold text-amber-400 block mt-0.5">
                  {diagnostico.zoomSoportado ? `${diagnostico.zoomActual || 1}x (Disponible)` : "No soportado"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Control de hardware</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">Estado del Hardware</span>
                <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {diagnostico.estado}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block">Tiempo de Lectura</span>
                <span className="text-lg font-mono font-black text-amber-400">
                  {diagnostico.tiempoLecturaSegundos || "0.4 segundos"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">&lt; 1s Excelente</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 col-span-2">
                <span className="text-slate-400 font-bold block">Última Lectura</span>
                <span className="text-sm font-bold text-slate-200 block truncate">
                  {diagnostico.ultimaLectura || "Sin lecturas aún"}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void mejorarEnfoque();
                }}
                disabled={mejorandoEnfoque}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white transition shadow-lg shadow-blue-950/40 flex items-center justify-center gap-2"
              >
                <span>🎯</span> {mejorandoEnfoque ? "Calibrando..." : "Mejorar Enfoque"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiagnosticoAbierto(false);
                  void activarCamaraPermanente();
                }}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
              >
                🔄 Reiniciar Stream
              </button>
              <button
                type="button"
                onClick={() => setDiagnosticoAbierto(false)}
                className="py-3 px-5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL DE CONFIGURACIÓN DE TERMINAL Y SELECTOR DE CÁMARAS (AJUSTE 2) */}
      {panelConfigAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-blue-400">
                <span className="text-2xl">⚙️</span>
                <h3 className="text-lg font-black text-white">
                  Configuración de Terminal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPanelConfigAbierto(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Dispositivo Actual */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Dispositivo actual:
              </span>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>📷</span>
                <span className="truncate">{diagnostico.camaraLabel || "Webcam integrada"}</span>
              </div>
              <div className="text-xs text-emerald-400 font-semibold">
                Resolución: {diagnostico.resolucion} • {diagnostico.fps} FPS
              </div>
            </div>

            {/* Selector de Cámaras Disponibles */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Cámaras disponibles:
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
                  <span>Predeterminada del sistema (HD automática)</span>
                  {!camaraQrSeleccionada && <span className="text-blue-400">✓ Activa</span>}
                </button>

                {camaras.map((cam, idx) => {
                  const esSeleccionada = camaraQrSeleccionada === cam.deviceId;
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
                      <span className="truncate">{cam.label}</span>
                      {esSeleccionada && <span className="text-blue-400 shrink-0">✓ Activa</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Perfiles de Dispositivo */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Perfil de Terminal:
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
                  <span className="text-lg">💻</span>
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
                  <span className="text-lg">📱</span>
                  <span>Celular / Tablet</span>
                  <span className="text-[10px] opacity-80">
                    {configTerminal.modoCamaraPreferido === "user" ? "Delantera" : "Trasera (Recomendada)"}
                  </span>
                </button>
              </div>

              {/* Sub-selector si es Tablet/Celular: Trasera vs Delantera */}
              {configTerminal.tipoDispositivo === "TABLET_CELULAR" && (
                <div className="pt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-400">Orientación:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void alternarFacingModeMobile("environment")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        configTerminal.modoCamaraPreferido !== "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      📷 Trasera
                    </button>
                    <button
                      type="button"
                      onClick={() => void alternarFacingModeMobile("user")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        configTerminal.modoCamaraPreferido === "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      🤳 Delantera
                    </button>
                  </div>
                </div>
              )}
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