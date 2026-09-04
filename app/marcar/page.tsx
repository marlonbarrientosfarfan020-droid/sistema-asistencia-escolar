"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FaIdCard } from "react-icons/fa";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";

type EstadoVisual =
  | "normal"
  | "entrada"
  | "salida"
  | "error";

type ResultadoAsistencia = {
  tipo?: "ENTRADA" | "SALIDA";
  message?: string;
  estudiante?: {
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
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

type CamaraDisponible = {
  deviceId: string;
  label: string;
};

const SEGUNDOS_PARA_FOTO = 1;
const TIEMPO_LIBERAR_CAMARA_MS = 400;

const STORAGE_CAMARA_QR =
  "camara_qr_device_id";

const STORAGE_CAMARA_FACIAL =
  "camara_facial_device_id";

export default function MarcarPage() {
  const router = useRouter();
  const { configuracion } =
    useConfiguracionColegio();

  const [dni, setDni] = useState("");
  const [mensaje, setMensaje] =
    useState("");

  const [resultado, setResultado] =
    useState<ResultadoAsistencia | null>(
      null
    );

  const [camaraActiva, setCamaraActiva] =
    useState(false);

  const [tomandoFoto, setTomandoFoto] =
    useState(false);

  const [
    reconociendoFacial,
    setReconociendoFacial,
  ] = useState(false);

  const [contadorFoto, setContadorFoto] =
    useState<number | null>(null);

  const [estadoVisual, setEstadoVisual] =
    useState<EstadoVisual>("normal");

  const [terminalAutorizado, setTerminalAutorizado] =
    useState<boolean | null>(null);
  const [pinTerminal, setPinTerminal] = useState("");
  const [errorPin, setErrorPin] = useState("");
  const [validandoPin, setValidandoPin] = useState(false);

  const [camaras, setCamaras] =
    useState<CamaraDisponible[]>([]);

  const [
    camaraQrSeleccionada,
    setCamaraQrSeleccionada,
  ] = useState("");

  const [
    camaraFacialSeleccionada,
    setCamaraFacialSeleccionada,
  ] = useState("");

  const [
    cargandoCamaras,
    setCargandoCamaras,
  ] = useState(false);

  const procesandoQR = useRef(false);

  const scannerRef =
    useRef<Html5Qrcode | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const streamFotoRef =
    useRef<MediaStream | null>(null);

  useEffect(() => {
    const logueado =
      localStorage.getItem("logueado");
    const terminalPinAuth =
      sessionStorage.getItem(
        "terminal_porteria_autorizado"
      );

    if (
      logueado === "true" ||
      terminalPinAuth === "true"
    ) {
      setTerminalAutorizado(true);
      void cargarCamaras();
    } else {
      setTerminalAutorizado(false);
      return;
    }

    window.history.pushState(
      null,
      "",
      window.location.href
    );

    const bloquearAtras = () => {
      window.history.pushState(
        null,
        "",
        window.location.href
      );
    };

    const actualizarCamaras = () => {
      void cargarCamaras();
    };

    window.addEventListener(
      "popstate",
      bloquearAtras
    );

    navigator.mediaDevices?.addEventListener(
      "devicechange",
      actualizarCamaras
    );

    return () => {
      window.removeEventListener(
        "popstate",
        bloquearAtras
      );

      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        actualizarCamaras
      );

      detenerCamaraFoto();
      void detenerCamaraQR();
    };
  }, [router, terminalAutorizado]);


  function nombreCamara(
    dispositivo: MediaDeviceInfo,
    indice: number
  ) {
    return (
      dispositivo.label.trim() ||
      `Cámara ${indice + 1}`
    );
  }

  function elegirCamaraPredeterminada({
    dispositivos,
    preferencia,
    tipo,
  }: {
    dispositivos: CamaraDisponible[];
    preferencia: string;
    tipo: "QR" | "FACIAL";
  }) {
    if (
      preferencia &&
      dispositivos.some(
        (camara) =>
          camara.deviceId ===
          preferencia
      )
    ) {
      return preferencia;
    }

    const palabras =
      tipo === "QR"
        ? [
            "back",
            "rear",
            "environment",
            "trasera",
          ]
        : [
            "front",
            "user",
            "facetime",
            "webcam",
            "integrated",
            "frontal",
          ];

    const encontrada =
      dispositivos.find((camara) =>
        palabras.some((palabra) =>
          camara.label
            .toLowerCase()
            .includes(palabra)
        )
      );

    if (encontrada) {
      return encontrada.deviceId;
    }

    return tipo === "QR"
      ? dispositivos.at(-1)
          ?.deviceId || ""
      : dispositivos[0]
          ?.deviceId || "";
  }

  async function cargarCamaras() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .enumerateDevices
    ) {
      return;
    }

    setCargandoCamaras(true);

    let streamTemporal:
      | MediaStream
      | null = null;

    try {
      const iniciales =
        await navigator.mediaDevices
          .enumerateDevices();

      const hayEtiquetas =
        iniciales.some(
          (dispositivo) =>
            dispositivo.kind ===
              "videoinput" &&
            Boolean(
              dispositivo.label
            )
        );

      if (!hayEtiquetas) {
        try {
          streamTemporal =
            await navigator.mediaDevices
              .getUserMedia({
                video: true,
                audio: false,
              });
        } catch {
          // Se mostrarán nombres genéricos.
        }
      }

      const dispositivos =
        await navigator.mediaDevices
          .enumerateDevices();

      const camarasEncontradas =
        dispositivos
          .filter(
            (dispositivo) =>
              dispositivo.kind ===
              "videoinput"
          )
          .map(
            (
              dispositivo,
              indice
            ) => ({
              deviceId:
                dispositivo.deviceId,

              label:
                nombreCamara(
                  dispositivo,
                  indice
                ),
            })
          );

      setCamaras(
        camarasEncontradas
      );

      const guardadaQr =
        localStorage.getItem(
          STORAGE_CAMARA_QR
        ) || "";

      const guardadaFacial =
        localStorage.getItem(
          STORAGE_CAMARA_FACIAL
        ) || "";

      setCamaraQrSeleccionada(
        elegirCamaraPredeterminada({
          dispositivos:
            camarasEncontradas,
          preferencia:
            guardadaQr,
          tipo: "QR",
        })
      );

      setCamaraFacialSeleccionada(
        elegirCamaraPredeterminada({
          dispositivos:
            camarasEncontradas,
          preferencia:
            guardadaFacial,
          tipo: "FACIAL",
        })
      );
    } catch (error) {
      console.error(
        "Error detectando cámaras:",
        error
      );

      setMensaje(
        "⚠️ No se pudieron listar las cámaras. Se usará la cámara predeterminada."
      );
    } finally {
      streamTemporal
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      setCargandoCamaras(false);
    }
  }

  function seleccionarCamaraQr(
    deviceId: string
  ) {
    setCamaraQrSeleccionada(
      deviceId
    );

    localStorage.setItem(
      STORAGE_CAMARA_QR,
      deviceId
    );
  }

  function seleccionarCamaraFacial(
    deviceId: string
  ) {
    setCamaraFacialSeleccionada(
      deviceId
    );

    localStorage.setItem(
      STORAGE_CAMARA_FACIAL,
      deviceId
    );
  }

  async function cerrarSesion() {
    try {
      localStorage.clear();
      sessionStorage.clear();

      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    } finally {
      detenerCamaraFoto();
      void detenerCamaraQR();
      window.location.replace("/login");
    }
  }

  function desbloquearConPin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorPin("");

    const pinLimpio = pinTerminal.trim();
    if (!pinLimpio) {
      setErrorPin("Por favor ingrese el PIN de seguridad del terminal.");
      return;
    }

    setValidandoPin(true);
    try {
      if (
        pinLimpio === "2026" ||
        pinLimpio === "1234" ||
        pinLimpio === "SR2026"
      ) {
        sessionStorage.setItem(
          "terminal_porteria_autorizado",
          "true"
        );
        sessionStorage.setItem(
          "terminal_porteria_pin",
          pinLimpio
        );
        localStorage.setItem(
          "terminal_porteria_pin",
          pinLimpio
        );
        setTerminalAutorizado(true);
        setErrorPin("");
      } else {
        setErrorPin(
          "PIN de terminal incorrecto. Comuníquese con la dirección escolar."
        );
      }
    } finally {
      setValidandoPin(false);
    }
  }

  function bloquearTerminal() {
    sessionStorage.removeItem(
      "terminal_porteria_autorizado"
    );
    sessionStorage.removeItem(
      "terminal_porteria_pin"
    );
    localStorage.removeItem(
      "terminal_porteria_pin"
    );
    detenerCamaraFoto();
    void detenerCamaraQR();
    setTerminalAutorizado(false);
    setPinTerminal("");
    setErrorPin("");
  }

  function beep(tipo: "ok" | "error") {
    const audio = new Audio(
      tipo === "ok"
        ? "/beep-ok.mp3"
        : "/beep-error.mp3"
    );

    audio.play().catch(() => {});
  }

  async function esperar(
    milisegundos: number
  ) {
    await new Promise<void>((resolve) => {
      window.setTimeout(
        resolve,
        milisegundos
      );
    });
  }

  async function detenerCamaraQR() {
    const scanner = scannerRef.current;

    if (scanner) {
      try {
        const estado = scanner.getState();

        if (
          estado === 2 ||
          estado === 3
        ) {
          await scanner.stop();
        }

        scanner.clear();
      } catch (error) {
        console.warn(
          "No se pudo detener completamente el lector QR:",
          error
        );
      } finally {
        scannerRef.current = null;
      }
    }

    setCamaraActiva(false);
    procesandoQR.current = false;

    await esperar(
      TIEMPO_LIBERAR_CAMARA_MS
    );
  }

  function detenerCamaraFoto() {
    const stream =
      streamFotoRef.current;

    if (stream) {
      stream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamFotoRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  async function tomarFotoEvidencia(
    deviceId?: string,
    modoCamara: "environment" | "user" = "environment"
  ): Promise<Blob | null> {
    console.log("[FOTO] iniciando captura");
    try {
      detenerCamaraFoto();
      setTomandoFoto(true);
      setContadorFoto(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("El navegador no permite acceder a la cámara");
      }

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 720 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: modoCamara },
                width: { ideal: 720 },
                height: { ideal: 720 },
              },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamFotoRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("No existe el elemento de video");
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        const temporizador = window.setTimeout(() => {
          reject(new Error("La cámara de evidencia tardó demasiado en iniciar (timeout 6s)"));
        }, 6000);

        const alIniciar = async () => {
          try {
            await video.play();
            window.clearTimeout(temporizador);
            resolve();
          } catch (error) {
            window.clearTimeout(temporizador);
            reject(error);
          }
        };

        if (video.readyState >= 2) {
          void alIniciar();
        } else {
          video.onloadedmetadata = () => {
            void alIniciar();
          };
        }
      });

      // Cuenta regresiva: 1 segundo
      for (let numero = SEGUNDOS_PARA_FOTO; numero >= 1; numero--) {
        setContadorFoto(numero);
        await esperar(1000);
      }
      setContadorFoto(null);

      const anchoOriginal = video.videoWidth || 720;
      const altoOriginal = video.videoHeight || 720;
      const maximo = 720;
      const escala = Math.min(maximo / anchoOriginal, maximo / altoOriginal, 1);
      const ancho = Math.round(anchoOriginal * escala);
      const alto = Math.round(altoOriginal * escala);

      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const contexto = canvas.getContext("2d");
      if (!contexto) {
        throw new Error("No se pudo crear la fotografía de evidencia");
      }
      contexto.drawImage(video, 0, 0, ancho, alto);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((resultadoBlob) => resolve(resultadoBlob), "image/jpeg", 0.72);
      });

      if (!blob) {
        throw new Error("No se pudo comprimir la fotografía");
      }

      console.log("[FOTO] archivo generado:", { size: blob.size, type: blob.type });
      return blob;
    } catch (error) {
      console.error("[FOTO] Error capturando fotografía:", error);
      const mensajeError = error instanceof Error ? error.message : "Error al capturar fotografía";
      setMensaje(`❌ ${mensajeError}`);
      setEstadoVisual("error");
      return null;
    } finally {
      detenerCamaraFoto();
      setTomandoFoto(false);
      setContadorFoto(null);
    }
  }

  async function subirFoto(foto: Blob): Promise<string> {
    console.log("[BLOB] subida iniciada");
    setMensaje("☁️ Subiendo fotografía a Vercel Blob...");

    const formData = new FormData();
    formData.append(
      "foto",
      new File([foto], `asistencia-${Date.now()}.jpg`, {
        type: "image/jpeg",
      })
    );

    const pinTerminal =
      sessionStorage.getItem("terminal_porteria_pin") ||
      localStorage.getItem("terminal_porteria_pin") ||
      "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const respuesta = await fetch("/api/asistencias/foto", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(pinTerminal ? { "x-terminal-pin": pinTerminal } : {}),
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const texto = await respuesta.text();

      let data: {
        ok?: boolean;
        fotoUrl?: string;
        message?: string;
      } = {};

      if (texto) {
        try {
          data = JSON.parse(texto);
        } catch {
          throw new Error("El servidor devolvió una respuesta inválida");
        }
      }

      if (!respuesta.ok || !data.fotoUrl) {
        throw new Error(data.message || `No se pudo guardar la fotografía en Blob (${respuesta.status})`);
      }

      console.log("[BLOB] URL obtenida:", data.fotoUrl);
      return data.fotoUrl;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Tiempo de espera agotado al subir a Vercel Blob (12s)");
      }
      throw err;
    }
  }

  async function registrarAsistencia(
    datos: {
      dni?: string;
      codigo?: string;
      metodo: string;
    },
    fotoPreparada?: Blob
  ) {
    setMensaje("");
    setResultado(null);

    try {
      if (camaraActiva || scannerRef.current) {
        await detenerCamaraQR();
      }

      let foto: Blob | null = fotoPreparada ?? null;

      if (!foto) {
        setMensaje("📸 Posicione la cámara hacia la estudiante o carnet...");
        foto = await tomarFotoEvidencia(
          camaraQrSeleccionada || undefined,
          "environment"
        );
      }

      if (!foto) {
        throw new Error("La fotografía es obligatoria para registrar la asistencia");
      }

      const fotoUrl = await subirFoto(foto);

      console.log("[ASISTENCIA] creando registro:", { ...datos, fotoUrl });
      setMensaje("⏳ Registrando asistencia...");

      const pinTerminal =
        sessionStorage.getItem("terminal_porteria_pin") ||
        localStorage.getItem("terminal_porteria_pin") ||
        "";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let data: ResultadoAsistencia & { message?: string; asistencia?: any } = {};

      try {
        const respuesta = await fetch("/api/asistencias", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(pinTerminal ? { "x-terminal-pin": pinTerminal } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            ...datos,
            fotoUrl,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const texto = await respuesta.text();

        if (texto) {
          try {
            data = JSON.parse(texto);
          } catch {
            throw new Error("La API de asistencia devolvió datos inválidos");
          }
        }

        if (!respuesta.ok) {
          const mensajeRespuesta =
            data.message || `No se pudo registrar la asistencia (${respuesta.status})`;

          const esAvisoDeEntradaExistente =
            respuesta.status === 400 &&
            mensajeRespuesta.includes("ya registró entrada hoy");

          if (esAvisoDeEntradaExistente) {
            setMensaje(`⚠️ ${mensajeRespuesta}`);
            setEstadoVisual("normal");
            beep("ok");

            window.setTimeout(() => {
              setMensaje("");
              setResultado(null);
            }, 5000);
            return;
          }

          throw new Error(mensajeRespuesta);
        }

        console.log("[ASISTENCIA] registro creado:", data.asistencia?.id || data);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          throw new Error("Tiempo de espera agotado al registrar en base de datos (12s)");
        }
        throw err;
      }

      setResultado(data);
      setMensaje(`✅ ${data.message || "Asistencia registrada"}`);
      setDni("");
      beep("ok");

      if (data.tipo === "ENTRADA") {
        setEstadoVisual("entrada");
      } else if (data.tipo === "SALIDA") {
        setEstadoVisual("salida");
      }

      window.setTimeout(() => {
        setEstadoVisual("normal");
        setMensaje("");
        setResultado(null);
      }, 4000);
    } catch (error) {
      console.error("[ASISTENCIA] Error en flujo de marcación:", error);
      const msg = error instanceof Error ? error.message : "Error al registrar asistencia";
      setMensaje(`❌ ${msg}`);
      setEstadoVisual("error");
      beep("error");

      window.setTimeout(() => {
        setEstadoVisual("normal");
      }, 5000);
    } finally {
      detenerCamaraFoto();
      setTomandoFoto(false);
      procesandoQR.current = false;
    }
  }

  async function marcarPorDni() {
    if (!dni.trim()) {
      setMensaje(
        "❌ Ingrese un DNI"
      );

      setEstadoVisual("error");
      return;
    }

    await registrarAsistencia({
      dni: dni.trim(),
      metodo: "DNI",
    });
  }

  async function marcarPorRostro() {
    if (
      tomandoFoto ||
      reconociendoFacial
    ) {
      return;
    }

    setReconociendoFacial(true);
    setResultado(null);
    setEstadoVisual("normal");
    setMensaje(
      "🙂 Mire de frente. Capturaremos su rostro en 1 segundo."
    );

    try {
      if (
        camaraActiva ||
        scannerRef.current
      ) {
        await detenerCamaraQR();
      }

      const foto =
        await tomarFotoEvidencia(
          camaraFacialSeleccionada,
          "user"
        );

      if (!foto) {
        throw new Error(
          "No se pudo capturar el rostro"
        );
      }

      setMensaje(
        "🧠 Buscando coincidencia facial en AWS Rekognition..."
      );

      const formData =
        new FormData();

      formData.append(
        "foto",
        new File(
          [foto],
          `reconocimiento-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        )
      );

      const respuesta =
        await fetch(
          "/api/biometria/reconocer",
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

      const texto =
        await respuesta.text();

      let data: ResultadoReconocimientoFacial =
        {};

      if (texto) {
        try {
          data = JSON.parse(texto);
        } catch {
          throw new Error(
            "La API facial devolvió una respuesta inválida"
          );
        }
      }

      if (
        !respuesta.ok ||
        !data.ok ||
        !data.reconocido ||
        !data.estudiante
      ) {
        throw new Error(
          data.message ||
            "No se reconoció al estudiante"
        );
      }

      const similitud =
        data.coincidencia?.similitud;

      setMensaje(
        `✅ ${data.estudiante.nombres} ${data.estudiante.apellidos} reconocido${
          typeof similitud === "number"
            ? ` con ${similitud.toFixed(2)}% de similitud`
            : ""
        }. Registrando asistencia...`
      );

      await registrarAsistencia(
        {
          dni:
            data.estudiante.dni,
          metodo: "FACIAL",
        },
        foto
      );
    } catch (error) {
      console.error(
        "Error en reconocimiento facial:",
        error
      );

      setMensaje(
        `❌ ${
          error instanceof Error
            ? error.message
            : "No se pudo reconocer el rostro"
        }`
      );

      setEstadoVisual("error");
      beep("error");

      window.setTimeout(() => {
        setEstadoVisual("normal");
      }, 3500);
    } finally {
      setReconociendoFacial(false);
      detenerCamaraFoto();
    }
  }

  function manejarEnterDni(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" &&
      !tomandoFoto
    ) {
      event.preventDefault();
      void marcarPorDni();
    }
  }

  async function activarCamara() {
    detenerCamaraFoto();
    setResultado(null);
    setMensaje("");
    setCamaraActiva(true);

    procesandoQR.current = false;

    window.setTimeout(async () => {
      const lector =
        new Html5Qrcode(
          "lector-qr"
        );

      scannerRef.current = lector;

      try {
        const configuracionCamara =
          camaraQrSeleccionada
            ? {
                deviceId:
                  camaraQrSeleccionada,
              }
            : {
                facingMode:
                  "environment",
              };

        await lector.start(
          configuracionCamara,
          {
            fps: 15,
            qrbox: {
              width: 250,
              height: 250,
            },
            aspectRatio: 1,
          },
          async (codigoLeido) => {
            if (
              procesandoQR.current
            ) {
              return;
            }

            procesandoQR.current = true;
            console.log("[QR] estudiante detectado:", codigoLeido.trim());

            // Capturar fotograma de evidencia directamente desde el video activo del sensor QR
            let fotoCapturada: Blob | null = null;
            try {
              const videoQR = document.querySelector("#lector-qr video") as HTMLVideoElement | null;
              if (videoQR && videoQR.videoWidth > 0 && videoQR.videoHeight > 0) {
                console.log("[FOTO] iniciando captura");
                const canvas = document.createElement("canvas");
                canvas.width = Math.min(videoQR.videoWidth, 720);
                canvas.height = Math.round((videoQR.videoHeight * canvas.width) / videoQR.videoWidth);
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(videoQR, 0, 0, canvas.width, canvas.height);
                  fotoCapturada = await new Promise<Blob | null>((res) => {
                    canvas.toBlob((b) => res(b), "image/jpeg", 0.72);
                  });
                  if (fotoCapturada) {
                    console.log("[FOTO] archivo generado:", { size: fotoCapturada.size, type: fotoCapturada.type });
                  }
                }
              }
            } catch (errFoto) {
              console.warn("No se pudo extraer fotograma directo del sensor QR:", errFoto);
            }

            await detenerCamaraQR();

            await registrarAsistencia(
              {
                codigo: codigoLeido.trim(),
                metodo: "QR",
              },
              fotoCapturada ?? undefined
            );
          },
          () => {}
        );
      } catch (error) {
        console.error(
          "Error activando lector QR:",
          error
        );

        scannerRef.current = null;
        procesandoQR.current = false;

        setMensaje(
          "❌ No se pudo activar la cámara. Verifique los permisos."
        );

        setEstadoVisual("error");
        setCamaraActiva(false);
      }
    }, 300);
  }

  const textoPrincipal =
    estadoVisual === "entrada"
      ? "Entrada registrada"
      : estadoVisual === "salida"
      ? "Salida registrada"
      : estadoVisual === "error"
      ? "No se pudo registrar"
      : "Marcar asistencia";

  const descripcionPrincipal =
    estadoVisual === "entrada"
      ? "El ingreso fue confirmado correctamente."
      : estadoVisual === "salida"
      ? "La salida fue confirmada correctamente."
      : estadoVisual === "error"
      ? "Revise el mensaje e inténtelo nuevamente."
      : "Escanee el QR, ingrese el DNI o use reconocimiento facial.";

  const colorMensaje =
    estadoVisual === "entrada"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100"
      : estadoVisual === "salida"
      ? "border-blue-500/30 bg-blue-500/15 text-blue-100"
      : estadoVisual === "error"
      ? "border-red-500/30 bg-red-500/15 text-red-100"
      : "border-violet-500/30 bg-violet-500/15 text-violet-100";

  if (terminalAutorizado === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800 shadow-2xl">
          <span className="animate-spin text-xl">⏳</span>
          <span className="font-bold text-sm">
            Verificando autorización de terminal...
          </span>
        </div>
      </main>
    );
  }

  if (terminalAutorizado === false) {
    return (
      <main
        className="min-h-screen flex items-center justify-center relative bg-slate-950 overflow-hidden p-4 sm:p-6 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/img/colegio-santa-rita.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-red-950/50" />

        <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-b from-slate-900 to-red-950 text-white p-8 text-center relative border-b-2 border-amber-400">
            <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-white p-1.5 shadow-xl ring-4 ring-amber-400/40">
              <Image
                src="/img/logo-santa-rita.png"
                alt="Escudo Santa Rita de Cassia"
                width={80}
                height={80}
                className="object-contain w-full h-full"
                priority
              />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest border border-amber-400/40 mb-2">
              <span>🔒</span>
              <span>Terminal de Portería Protegido</span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">
              {configuracion.nombreColegio || "I.E.P. Santa Rita de Cassia"}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Estación de Marcación de Asistencia Escolar
            </p>
          </div>

          <form
            onSubmit={desbloquearConPin}
            className="p-8 space-y-5"
          >
            {errorPin && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <span className="text-base leading-none">⚠️</span>
                <span className="leading-relaxed">{errorPin}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Código PIN de Terminal (Portería)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-slate-400">
                  🔢
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  value={pinTerminal}
                  onChange={(e) => setPinTerminal(e.target.value)}
                  placeholder="Ingrese PIN de 4 dígitos"
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-300 text-base font-mono font-bold tracking-[0.3em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50 text-center"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                PIN de estación para operadores autorizados
              </p>
            </div>

            <button
              type="submit"
              disabled={validandoPin}
              className="w-full py-4 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all duration-200 border border-amber-300 flex items-center justify-center gap-2"
            >
              <span>🔓</span>
              <span>
                {validandoPin ? "Verificando PIN..." : "DESBLOQUEAR TERMINAL"}
              </span>
            </button>

            <div className="pt-3 border-t border-slate-200 space-y-2 text-center">
              <button
                type="button"
                onClick={() => router.push("/login?retorno=/marcar")}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition flex items-center justify-center gap-2"
              >
                <span>👤</span>
                <span>Ingresar con Usuario de Personal</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1 pt-1"
              >
                <span>←</span>
                <span>Regresar al portal institucional</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-cover bg-center p-4 sm:p-6"
      style={{
        backgroundImage:
          "url('/img/colegio-santa-rita.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-transparent to-emerald-950/30" />

      <div className="relative z-20 mx-auto flex max-w-[1500px] items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm font-black text-white shadow-xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-slate-900"
          >
            <span>🌐</span>
            <span>Portada Web</span>
          </button>

          {typeof window !== "undefined" &&
            localStorage.getItem("logueado") === "true" && (
              <button
                type="button"
                onClick={() =>
                  router.replace(
                    "/dashboard"
                  )
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm font-black text-white shadow-xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-slate-900"
              >
                <span>←</span>
                <span className="hidden sm:inline">Panel</span>
              </button>
            )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={bloquearTerminal}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/20 px-4 py-3 text-sm font-black text-amber-300 shadow-xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-amber-500/30"
            title="Bloquear estación de portería"
          >
            <span>🔒</span>
            <span className="hidden sm:inline">Bloquear Terminal</span>
          </button>

          <button
            type="button"
            onClick={cerrarSesion}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-red-700"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">
              Cerrar sesión
            </span>
          </button>
        </div>
      </div>

      <video
        ref={videoRef}
        className={
          tomandoFoto
            ? "fixed inset-0 z-[70] h-full w-full object-cover"
            : "hidden"
        }
        playsInline
        muted
      />

      {tomandoFoto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-5">
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-5 py-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-white/75">
              Captura automática
            </p>

            <h2 className="mt-2 text-2xl font-black text-white sm:text-4xl">
              Mire hacia la cámara
            </h2>
          </div>

          <div className="relative flex h-64 w-64 items-center justify-center rounded-full border-8 border-white/80 bg-black/30 shadow-[0_0_80px_rgba(59,130,246,0.7)] backdrop-blur-sm sm:h-80 sm:w-80">
            {contadorFoto !== null ? (
              <span className="text-9xl font-black text-white drop-shadow-2xl">
                {contadorFoto}
              </span>
            ) : (
              <div className="text-center">
                <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white" />

                <p className="mt-4 font-black text-white">
                  Preparando cámara...
                </p>
              </div>
            )}
          </div>

          <p className="absolute inset-x-0 bottom-8 text-center text-sm font-bold text-white/80">
            La fotografía se tomará automáticamente.
          </p>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] max-w-[1500px] items-center justify-center py-6">
        <section className="w-full overflow-hidden rounded-[34px] border border-white/20 bg-white/90 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:max-w-6xl">
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-white via-blue-50/70 to-emerald-50/70 px-6 py-6 text-center sm:px-10">
            {configuracion.logoUrl ? (
              <img
                src={
                  configuracion.logoUrl
                }
                alt={`Logo de ${configuracion.nombreColegio}`}
                className="mx-auto h-[88px] w-[88px] rounded-3xl bg-white object-contain p-2 shadow-xl ring-1 ring-slate-200"
              />
            ) : (
              <Image
                src="/img/logo-santa-rita.png"
                alt="Logo institucional"
                width={88}
                height={88}
                className="mx-auto rounded-3xl bg-white p-2 shadow-xl ring-1 ring-slate-200"
                priority
              />
            )}

            <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              {
                configuracion.nombreColegio
              }
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {textoPrincipal}
            </h1>

            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-slate-500 sm:text-base">
              {descripcionPrincipal}
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {mensaje && (
              <div
                className={`mb-6 rounded-2xl border px-5 py-4 text-center text-base font-black shadow-sm ${colorMensaje}`}
              >
                {mensaje}
              </div>
            )}

            {resultado?.estudiante && (
              <div className="mb-6 overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-5">
                <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
                      Registro confirmado
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                      {
                        resultado
                          .estudiante
                          .nombres
                      }{" "}
                      {
                        resultado
                          .estudiante
                          .apellidos
                      }
                    </h2>

                    <p className="mt-1 font-semibold text-slate-600">
                      Grado{" "}
                      {
                        resultado
                          .estudiante
                          .grado
                      }{" "}
                      · Sección{" "}
                      {
                        resultado
                          .estudiante
                          .seccion
                      }
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Hora registrada
                    </p>

                    <p className="mt-1 text-2xl font-black tabular-nums">
                      {new Date().toLocaleTimeString(
                        "es-PE",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second:
                            "2-digit",
                          timeZone:
                            "America/Lima",
                        }
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-3">
              <article className="group rounded-[28px] border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-5 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-200">
                    📷
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      Escanear QR
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Use la cámara trasera para leer el carnet.
                    </p>
                  </div>
                </div>

                <label className="mt-6 block">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                    Cámara para QR
                  </span>

                  <select
                    value={
                      camaraQrSeleccionada
                    }
                    onChange={(event) =>
                      seleccionarCamaraQr(
                        event.target.value
                      )
                    }
                    disabled={
                      camaraActiva ||
                      tomandoFoto ||
                      cargandoCamaras
                    }
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-blue-200 bg-white px-4 font-bold text-slate-800 outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    {camaras.length ===
                    0 ? (
                      <option value="">
                        Cámara predeterminada
                      </option>
                    ) : (
                      camaras.map(
                        (camara) => (
                          <option
                            key={
                              camara.deviceId
                            }
                            value={
                              camara.deviceId
                            }
                          >
                            {
                              camara.label
                            }
                          </option>
                        )
                      )
                    )}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    void cargarCamaras()
                  }
                  disabled={
                    camaraActiva ||
                    cargandoCamaras
                  }
                  className="mt-3 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  {cargandoCamaras
                    ? "Buscando cámaras..."
                    : "🔄 Actualizar cámaras"}
                </button>

                {!camaraActiva ? (
                  <button
                    type="button"
                    onClick={activarCamara}
                    disabled={
                      tomandoFoto
                    }
                    className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    📷 Activar cámara QR
                  </button>
                ) : (
                  <div className="mt-6">
                    <div className="overflow-hidden rounded-3xl border-4 border-blue-500 bg-slate-950 p-1 shadow-2xl">
                      <div
                        id="lector-qr"
                        className="overflow-hidden rounded-2xl"
                      />
                    </div>

                    <p className="mt-3 text-center text-sm font-bold text-blue-700">
                      Acerque el código QR al centro del recuadro.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        void detenerCamaraQR()
                      }
                      className="mt-4 w-full rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-3 font-black text-red-700 transition hover:bg-red-100"
                    >
                      Detener cámara
                    </button>
                  </div>
                )}
              </article>

              <article className="group rounded-[28px] border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                    <FaIdCard className="text-2xl" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      Registrar por DNI
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Alternativa manual cuando no se puede leer el QR.
                    </p>
                  </div>
                </div>

                <label className="mt-6 block">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    DNI del estudiante
                  </span>

                  <div className="relative mt-2">
                    <FaIdCard className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-emerald-600" />

                    <input
                      value={dni}
                      onChange={(event) =>
                        setDni(
                          event.target.value
                            .replace(
                              /\D/g,
                              ""
                            )
                            .slice(0, 8)
                        )
                      }
                      onKeyDown={
                        manejarEnterDni
                      }
                      placeholder="Ingrese 8 dígitos"
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={
                        tomandoFoto
                      }
                      className="h-16 w-full rounded-2xl border-2 border-slate-200 bg-white pl-12 pr-4 text-center text-2xl font-black tracking-[0.18em] text-slate-950 outline-none transition placeholder:text-base placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:opacity-60"
                    />
                  </div>
                </label>

                <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>
                    {dni.length}/8 dígitos
                  </span>

                  <span>
                    También puede presionar Enter
                  </span>
                </div>

                <button
                  type="button"
                  onClick={marcarPorDni}
                  disabled={
                    tomandoFoto ||
                    dni.length !== 8
                  }
                  className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tomandoFoto
                    ? "📸 Tomando fotografía..."
                    : "✅ Marcar asistencia"}
                </button>
              </article>

              <article className="group rounded-[28px] border border-violet-200 bg-gradient-to-br from-white to-violet-50/70 p-5 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-2xl text-white shadow-lg shadow-violet-200">
                    🙂
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      Reconocimiento facial
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Identificación automática mediante AWS Rekognition.
                    </p>
                  </div>
                </div>

                <label className="mt-6 block">
                  <span className="text-xs font-black uppercase tracking-wider text-violet-700">
                    Cámara para rostro
                  </span>

                  <select
                    value={
                      camaraFacialSeleccionada
                    }
                    onChange={(event) =>
                      seleccionarCamaraFacial(
                        event.target.value
                      )
                    }
                    disabled={
                      tomandoFoto ||
                      reconociendoFacial ||
                      camaraActiva ||
                      cargandoCamaras
                    }
                    className="mt-2 h-12 w-full rounded-2xl border-2 border-violet-200 bg-white px-4 font-bold text-slate-800 outline-none focus:border-violet-500 disabled:opacity-60"
                  >
                    {camaras.length ===
                    0 ? (
                      <option value="">
                        Cámara predeterminada
                      </option>
                    ) : (
                      camaras.map(
                        (camara) => (
                          <option
                            key={
                              camara.deviceId
                            }
                            value={
                              camara.deviceId
                            }
                          >
                            {
                              camara.label
                            }
                          </option>
                        )
                      )
                    )}
                  </select>
                </label>

                <div className="mt-4 rounded-2xl border border-violet-200 bg-white/80 p-5">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-violet-500 bg-violet-50 text-6xl shadow-[0_0_35px_rgba(124,58,237,0.25)]">
                    👤
                  </div>

                  <p className="mt-4 text-center text-sm font-bold text-slate-600">
                    Mire de frente, mantenga buena iluminación y asegúrese de que aparezca una sola persona.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={marcarPorRostro}
                  disabled={
                    tomandoFoto ||
                    reconociendoFacial ||
                    camaraActiva
                  }
                  className="mt-6 w-full rounded-2xl bg-violet-600 px-5 py-4 font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reconociendoFacial
                    ? "🧠 Reconociendo estudiante..."
                    : tomandoFoto
                    ? "📸 Capturando rostro..."
                    : "🙂 Marcar con rostro"}
                </button>

                <div className="mt-4 grid grid-cols-2 gap-3 text-center text-xs font-black">
                  <div className="rounded-xl bg-violet-100 px-3 py-3 text-violet-700">
                    AWS Rekognition
                  </div>

                  <div className="rounded-xl bg-emerald-100 px-3 py-3 text-emerald-700">
                    Neon conectado
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center text-xs font-semibold text-slate-500 sm:flex-row sm:text-left">
              <p>
                🔒 QR, DNI y facial usan fotografía como evidencia.
              </p>

              <p>
                ⚡ Captura automática en 1 segundo.
              </p>

              <p>
                🎥 La cámara elegida queda guardada en este equipo.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}