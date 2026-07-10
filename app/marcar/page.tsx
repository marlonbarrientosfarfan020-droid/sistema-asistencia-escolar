"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FaIdCard } from "react-icons/fa";

export default function MarcarPage() {
  const router = useRouter();

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
      detenerCamaraQR();
    };
  }, [router]);

  async function cerrarSesion() {
  try {
    await fetch("/api/logout", {
      method: "POST",
    });
  } finally {
    localStorage.removeItem("logueado");
    localStorage.removeItem("rol");
    localStorage.removeItem("usuario");

    window.history.replaceState(null, "", "/login");
    router.replace("/login");
  }
}

  function beep(tipo: "ok" | "error") {
    const audio = new Audio(tipo === "ok" ? "/beep-ok.mp3" : "/beep-error.mp3");
    audio.play().catch(() => {});
  }

  async function detenerCamaraQR() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }

    setCamaraActiva(false);
    procesandoQR.current = false;
  }

  function detenerCamaraFoto() {
    if (streamFotoRef.current) {
      streamFotoRef.current.getTracks().forEach((track) => track.stop());
      streamFotoRef.current = null;
    }
  }

  async function tomarFotoSelfie(): Promise<string | null> {
    try {
      setTomandoFoto(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamFotoRef.current = stream;

      if (!videoRef.current) return null;

      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (!videoRef.current) return resolve();

        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          resolve();
        };
      });

      for (let i = 3; i >= 1; i--) {
        setContadorFoto(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setContadorFoto(null);

      const video = videoRef.current;
      if (!video) return null;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const fotoBase64 = canvas.toDataURL("image/jpeg", 0.8);

      detenerCamaraFoto();
      setTomandoFoto(false);

      return fotoBase64;
    } catch (error) {
      console.error(error);
      detenerCamaraFoto();
      setTomandoFoto(false);
      setContadorFoto(null);
      setMensaje("❌ No se pudo tomar la foto. Verifique permisos de cámara.");
      setEstadoVisual("error");
      beep("error");
      return null;
    }
  }

  async function registrarAsistencia(datos: {
    dni?: string;
    codigo?: string;
    metodo: string;
  }) {
    setMensaje("");
    setResultado(null);

    const fotoBase64 = await tomarFotoSelfie();

    if (!fotoBase64) {
      setMensaje("❌ La foto es obligatoria para marcar asistencia.");
      setEstadoVisual("error");
      beep("error");
      return;
    }

    const res = await fetch("/api/asistencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...datos,
        fotoBase64,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setResultado(data);
      setMensaje(`✅ ${data.message}`);
      setDni("");
      beep("ok");

      if (data.tipo === "ENTRADA") setEstadoVisual("entrada");
      if (data.tipo === "SALIDA") setEstadoVisual("salida");

      setTimeout(() => setEstadoVisual("normal"), 2500);
    } else {
      setMensaje(`❌ ${data.message}`);
      setEstadoVisual("error");
      beep("error");

      setTimeout(() => setEstadoVisual("normal"), 2500);
    }
  }

  async function marcarPorDni() {
    if (!dni.trim()) {
      setMensaje("❌ Ingrese un DNI");
      return;
    }

    await registrarAsistencia({
      dni: dni.trim(),
      metodo: "DNI",
    });
  }

  async function activarCamara() {
    setCamaraActiva(true);
    procesandoQR.current = false;

    setTimeout(async () => {
      const lector = new Html5Qrcode("lector-qr");
      scannerRef.current = lector;

      try {
        await lector.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (codigoLeido) => {
            if (procesandoQR.current) return;

            procesandoQR.current = true;

            await detenerCamaraQR();

            await registrarAsistencia({
              codigo: codigoLeido,
              metodo: "QR",
            });

            setTimeout(() => {
              procesandoQR.current = false;
            }, 3000);
          },
          () => {}
        );
      } catch (error) {
        console.error(error);
        setMensaje("❌ No se pudo activar la cámara. Verifique permisos.");
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
        backgroundImage: "url('/img/colegio-santa-rita.jpg')",
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

      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-5xl">
        <div className="text-center">
          <Image
            src="/img/logo-santa-rita.png"
            alt="Logo Santa Rita de Casia"
            width={95}
            height={95}
            className="mx-auto mb-3"
          />

          <h1 className="text-5xl font-extrabold text-slate-900">
            {textoPrincipal}
          </h1>

          <p className="text-slate-600 mt-2 text-lg">
            Escanea el QR o ingresa el DNI del estudiante
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
              {resultado.estudiante.nombres} {resultado.estudiante.apellidos}
            </h2>

            <p className="text-xl text-slate-600 mt-2">
              Grado {resultado.estudiante.grado} - Sección{" "}
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
            <h2 className="text-2xl font-bold">Escanear QR</h2>

            {!camaraActiva && (
              <button
                onClick={activarCamara}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold"
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
                  onClick={detenerCamaraQR}
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
                setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              placeholder="Ingrese DNI"
              className="mt-6 border rounded-xl p-3 w-full text-center text-xl"
            />

            <button
              onClick={marcarPorDni}
              disabled={tomandoFoto}
              className="mt-4 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold w-full disabled:opacity-50"
            >
              {tomandoFoto ? "Tomando foto..." : "Marcar asistencia"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}