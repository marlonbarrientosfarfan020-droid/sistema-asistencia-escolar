"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { FaIdCard } from "react-icons/fa";

export default function MarcarPage() {
  const router = useRouter();

  const [dni, setDni] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [estadoVisual, setEstadoVisual] = useState<
    "normal" | "entrada" | "salida" | "error"
  >("normal");

  const procesandoQR = useRef(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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
  };
}, [router]);

  function cerrarSesion() {
  localStorage.removeItem("logueado");
  localStorage.removeItem("rol");
  localStorage.removeItem("usuario");

  window.history.replaceState(null, "", "/login");
  router.replace("/login");
}

  function beep(tipo: "ok" | "error") {
    const audio = new Audio(tipo === "ok" ? "/beep-ok.mp3" : "/beep-error.mp3");
    audio.play().catch(() => {});
  }

  async function registrarAsistencia(datos: {
    dni?: string;
    codigo?: string;
    metodo: string;
  }) {
    setMensaje("");
    setResultado(null);

    const res = await fetch("/api/asistencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
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

  function activarCamara() {
    setCamaraActiva(true);
    procesandoQR.current = false;

    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "lector-qr",
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
        },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        async (codigoLeido) => {
          if (procesandoQR.current) return;

          procesandoQR.current = true;

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
    }, 300);
  }

  async function detenerCamara() {
    if (scannerRef.current) {
      await scannerRef.current.clear();
      scannerRef.current = null;
    }

    setCamaraActiva(false);
    procesandoQR.current = false;
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

      <button
        onClick={cerrarSesion}
        className="absolute top-5 right-5 z-20 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold shadow"
      >
        🚪 Cerrar sesión
      </button>

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

        {mensaje && (
          <p className={`mt-6 text-center text-2xl font-bold text-white rounded-2xl py-4 ${colorEstado}`}>
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
                <div id="lector-qr" />

                <button
                  onClick={detenerCamara}
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
            <h2 className="text-2xl font-bold text-center">Registrar por DNI</h2>

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
              className="mt-4 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold w-full"
            >
              Marcar asistencia
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}