"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FaIdCard } from "react-icons/fa";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";

export default function MarcarPage() {
  const router = useRouter();
  const { configuracion } = useConfiguracionColegio();

  const [dni, setDni] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [tomandoFoto, setTomandoFoto] = useState(false);
  const [contadorFoto, setContadorFoto] = useState<number | null>(null);

  const [estadoVisual, setEstadoVisual] = useState<
    "normal" | "entrada" | "salida" | "error"
  >("normal");

  const procesandoQR = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamFotoRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const logueado = localStorage.getItem("logueado");

    if (logueado !== "true") {
      router.replace("/login");
      return;
    }

    window.history.pushState(null, "", window.location.href);

    const bloquearAtras = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", bloquearAtras);

    return () => {
      window.removeEventListener("popstate", bloquearAtras);
      detenerCamaraFoto();
      void detenerCamaraQR();
    };
  }, [router]);

  async function cerrarSesion() {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
    } finally {
      detenerCamaraFoto();
      await detenerCamaraQR();

      localStorage.removeItem("logueado");
      localStorage.removeItem("rol");
      localStorage.removeItem("usuario");

      window.history.replaceState(null, "", "/login");
      router.replace("/login");
    }
  }

  function beep(tipo: "ok" | "error") {
    const audio = new Audio(
      tipo === "ok" ? "/beep-ok.mp3" : "/beep-error.mp3"
    );

    audio.play().catch(() => {});
  }

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
        console.warn(
          "No se pudo detener completamente el QR:",
          error
        );
      } finally {
        scannerRef.current = null;
      }
    }

    setCamaraActiva(false);
    procesandoQR.current = false;

    // Espera para que Android libere la cámara trasera.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  function detenerCamaraFoto() {
    const stream = streamFotoRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });

      streamFotoRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  async function tomarFotoSelfie(): Promise<Blob | null> {
    try {
      detenerCamaraFoto();
      setTomandoFoto(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "El navegador no permite acceder a la cámara"
        );
      }

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
  ideal: "environment",
},
            width: {
              ideal: 720,
            },
            height: {
              ideal: 720,
            },
          },
          audio: false,
        });
      } catch {
        // Respaldo para laptops o celulares que no respetan facingMode.
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
          reject(
            new Error("La cámara tardó demasiado en iniciar")
          );
        }, 8000);

        video.onloadedmetadata = async () => {
          try {
            await video.play();
            window.clearTimeout(temporizador);
            resolve();
          } catch (error) {
            window.clearTimeout(temporizador);
            reject(error);
          }
        };
      });

      for (let numero = 2; numero >= 1; numero--) {
        setContadorFoto(numero);

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }

      setContadorFoto(null);

      const anchoOriginal = video.videoWidth || 720;
      const altoOriginal = video.videoHeight || 720;

      const maximo = 720;

      const escala = Math.min(
        maximo / anchoOriginal,
        maximo / altoOriginal,
        1
      );

      const ancho = Math.round(anchoOriginal * escala);
      const alto = Math.round(altoOriginal * escala);

      const canvas = document.createElement("canvas");

      canvas.width = ancho;
      canvas.height = alto;

      const contexto = canvas.getContext("2d");

      if (!contexto) {
        throw new Error("No se pudo crear la fotografía");
      }

      contexto.drawImage(video, 0, 0, ancho, alto);

      const blob = await new Promise<Blob | null>(
        (resolve) => {
          canvas.toBlob(
            (resultadoBlob) => resolve(resultadoBlob),
            "image/jpeg",
            0.72
          );
        }
      );

      if (!blob) {
        throw new Error(
          "No se pudo comprimir la fotografía"
        );
      }

      return blob;
    } catch (error) {
      console.error("Error capturando selfie:", error);

      setMensaje(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ No se pudo tomar la fotografía"
      );

      setEstadoVisual("error");
      return null;
    } finally {
      detenerCamaraFoto();
      setTomandoFoto(false);
      setContadorFoto(null);
    }
  }

  async function subirFoto(foto: Blob): Promise<string> {
    const formData = new FormData();

    formData.append(
      "foto",
      new File(
        [foto],
        `asistencia-${Date.now()}.jpg`,
        {
          type: "image/jpeg",
        }
      )
    );

    const respuesta = await fetch(
      "/api/asistencias/foto",
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

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
        throw new Error(
          "El servidor devolvió una respuesta inválida"
        );
      }
    }

    if (!respuesta.ok || !data.fotoUrl) {
      throw new Error(
        data.message ||
          "No se pudo guardar la fotografía"
      );
    }

    return data.fotoUrl;
  }

  async function registrarAsistencia(datos: {
    dni?: string;
    codigo?: string;
    metodo: string;
  }) {
    setMensaje("");
    setResultado(null);

    try {
      // Detiene completamente el QR antes de abrir la cámara frontal.
      if (camaraActiva || scannerRef.current) {
        await detenerCamaraQR();
      }

      setMensaje(
        "📸 Prepare el rostro para la fotografía"
      );

      const foto = await tomarFotoSelfie();

      if (!foto) {
        throw new Error(
          "La fotografía es obligatoria para registrar la asistencia"
        );
      }

      setMensaje("⏳ Guardando fotografía...");

      const fotoUrl = await subirFoto(foto);

      setMensaje("⏳ Registrando asistencia...");

      const respuesta = await fetch(
        "/api/asistencias",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...datos,
            fotoUrl,
          }),
        }
      );

      const texto = await respuesta.text();

      let data: any = {};

      if (texto) {
        try {
          data = JSON.parse(texto);
        } catch {
          throw new Error(
            "La API de asistencia devolvió datos inválidos"
          );
        }
      }

      if (!respuesta.ok) {
        throw new Error(
          data.message ||
            `No se pudo registrar la asistencia (${respuesta.status})`
        );
      }

      setResultado(data);
      setMensaje(
        `✅ ${data.message || "Asistencia registrada"}`
      );
      setDni("");
      beep("ok");

      if (data.tipo === "ENTRADA") {
        setEstadoVisual("entrada");
      } else if (data.tipo === "SALIDA") {
        setEstadoVisual("salida");
      }

      setTimeout(() => {
        setEstadoVisual("normal");
      }, 3000);
    } catch (error) {
      console.error(
        "Error registrando asistencia:",
        error
      );

      setMensaje(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Error al registrar asistencia"
        }`
      );

      setEstadoVisual("error");
      beep("error");

      setTimeout(() => {
        setEstadoVisual("normal");
      }, 3500);
    } finally {
      detenerCamaraFoto();
      setTomandoFoto(false);
    }
  }

  async function marcarPorDni() {
    if (!dni.trim()) {
      setMensaje("❌ Ingrese un DNI");
      setEstadoVisual("error");
      return;
    }

    await registrarAsistencia({
      dni: dni.trim(),
      metodo: "DNI",
    });
  }

  async function activarCamara() {
    detenerCamaraFoto();
    setCamaraActiva(true);
    procesandoQR.current = false;

    setTimeout(async () => {
      const lector = new Html5Qrcode("lector-qr");
      scannerRef.current = lector;

      try {
        await lector.start(
          {
            facingMode: "environment",
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          async (codigoLeido) => {
            if (procesandoQR.current) return;

            procesandoQR.current = true;

            await detenerCamaraQR();

            await registrarAsistencia({
              codigo: codigoLeido,
              metodo: "QR",
            });
          },
          () => {}
        );
      } catch (error) {
        console.error(error);

        scannerRef.current = null;
        procesandoQR.current = false;

        setMensaje(
          "❌ No se pudo activar la cámara. Verifique permisos."
        );

        setEstadoVisual("error");
        setCamaraActiva(false);
      }
    }, 300);
  }

  const textoPrincipal =
    estadoVisual === "entrada"
      ? "✅ Entrada registrada"
      : estadoVisual === "salida"
      ? "👋 Salida registrada"
      : estadoVisual === "error"
      ? "❌ Error"
      : "Marcar Asistencia";

  const colorEstado =
    estadoVisual === "entrada"
      ? "bg-green-600"
      : estadoVisual === "salida"
      ? "bg-blue-600"
      : estadoVisual === "error"
      ? "bg-red-600"
      : "bg-blue-600";

  return (
    <main
      className="min-h-screen bg-cover bg-center relative flex items-center justify-center p-6"
      style={{
        backgroundImage:
          "url('/img/colegio-santa-rita.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/45" />

      {contadorFoto !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-white rounded-full w-52 h-52 flex items-center justify-center shadow-2xl border-8 border-blue-600">
            <span className="text-8xl font-extrabold text-blue-600">
              {contadorFoto}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={cerrarSesion}
        className="absolute top-5 right-5 z-20 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold shadow"
      >
        🚪 Cerrar sesión
      </button>

      <button
        onClick={() => router.replace("/dashboard")}
        className="absolute top-5 left-5 z-20 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold shadow"
      >
        ⬅️ Volver al panel
      </button>

      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-5xl">
        <div className="text-center">
          {configuracion.logoUrl ? (
            <img
              src={configuracion.logoUrl}
              alt={`Logo de ${configuracion.nombreColegio}`}
              className="mx-auto mb-3 h-[95px] w-[95px] rounded-2xl bg-white object-contain p-2 shadow"
            />
          ) : (
            <Image
              src="/img/logo-santa-rita.png"
              alt="Logo institucional"
              width={95}
              height={95}
              className="mx-auto mb-3 rounded-2xl bg-white p-2 shadow"
              priority
            />
          )}

          <h2 className="text-xl font-bold text-slate-700">
            {configuracion.nombreColegio}
          </h2>

          <h1 className="text-5xl font-extrabold text-slate-900">
            {textoPrincipal}
          </h1>

          <p className="text-slate-600 mt-2 text-lg">
            Escanea el QR o ingresa el DNI del
            estudiante
          </p>
        </div>

        {tomandoFoto && contadorFoto === null && (
          <p className="mt-6 text-center text-2xl font-bold text-white rounded-2xl py-4 bg-purple-600">
            📸 Capturando foto del estudiante...
          </p>
        )}

        {mensaje && (
          <p
            className={`mt-6 text-center text-2xl font-bold text-white rounded-2xl py-4 ${colorEstado}`}
          >
            {mensaje}
          </p>
        )}

        {resultado && (
          <div className="mt-6 bg-slate-100 rounded-2xl p-6 text-center">
            <h2 className="text-4xl font-extrabold">
              {resultado.estudiante.nombres}{" "}
              {resultado.estudiante.apellidos}
            </h2>

            <p className="text-xl text-slate-600 mt-2">
              Grado {resultado.estudiante.grado} -
              Sección{" "}
              {resultado.estudiante.seccion}
            </p>

            <p className="text-2xl font-bold mt-4">
              {new Date().toLocaleTimeString("es-PE")}
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="border-2 border-blue-100 bg-white rounded-3xl p-6 text-center shadow">
            <div className="text-6xl mb-4">📷</div>

            <h2 className="text-2xl font-bold">
              Escanear QR
            </h2>

            {!camaraActiva && (
              <button
                onClick={activarCamara}
                disabled={tomandoFoto}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                Activar cámara
              </button>
            )}

            {camaraActiva && (
              <div className="mt-6">
                <div
                  id="lector-qr"
                  className="overflow-hidden rounded-2xl border-4 border-blue-600"
                />

                <button
                  onClick={() => void detenerCamaraQR()}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold"
                >
                  Detener cámara
                </button>
              </div>
            )}
          </div>

          <div className="border-2 border-green-100 bg-white rounded-3xl p-6 shadow">
            <div className="flex justify-center mb-4">
              <FaIdCard className="text-6xl text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold text-center">
              Registrar por DNI
            </h2>

            <input
              value={dni}
              onChange={(e) =>
                setDni(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 8)
                )
              }
              placeholder="Ingrese DNI"
              disabled={tomandoFoto}
              className="mt-6 border rounded-xl p-3 w-full text-center text-xl disabled:opacity-50"
            />

            <button
              onClick={marcarPorDni}
              disabled={tomandoFoto}
              className="mt-4 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold w-full disabled:opacity-50"
            >
              {tomandoFoto
                ? "Tomando foto..."
                : "Marcar asistencia"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}