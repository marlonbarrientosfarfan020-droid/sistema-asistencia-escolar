"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginTransition3D, { LoginTransition3DProps } from "@/components/LoginTransition3D";

export default function PortalPadresLoginPage() {
  const router = useRouter();
  const [dni, setDni] = useState("");
  const [codigoFamiliar, setCodigoFamiliar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [comprobando, setComprobando] = useState(true);
  const [error, setError] = useState("");
  const [transicionLogin, setTransicionLogin] = useState<LoginTransition3DProps | null>(null);

  // Verificar si ya tiene sesión activa
  useEffect(() => {
    async function verificarSesion() {
      try {
        const res = await fetch("/api/portal-padres/datos");
        if (res.ok) {
          router.replace("/portal-padres/dashboard");
          return;
        }
      } catch {}
      setComprobando(false);
    }
    verificarSesion();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!dni.trim() || !/^\d{8}$/.test(dni.trim())) {
      setError("Por favor ingrese los 8 dígitos del DNI de su hija.");
      return;
    }

    if (!codigoFamiliar.trim()) {
      setError("Por favor ingrese el Código Familiar emitido por la institución.");
      return;
    }

    setCargando(true);

    try {
      const res = await fetch("/api/portal-padres/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dni: dni.trim(),
          codigoFamiliar: codigoFamiliar.trim().toUpperCase(),
        }),
      });

      const contentType = res.headers.get("content-type");
      let data: any = null;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      }

      if (!res.ok) {
        setError(data?.message || "Credenciales no válidas. Verifique el DNI y código.");
        return;
      }

      const nombreHija = data?.familia?.estudiante?.nombres
        ? `Familia de ${data.familia.estudiante.nombres}`
        : `Familia (${codigoFamiliar.trim().toUpperCase()})`;

      setTransicionLogin({
        usuario: data?.familia?.tutorTitular || "Familia Santarritina",
        tipoUsuario: "FAMILIA / APODERADO",
        nombreEstudiante: nombreHija,
        rutaDestino: "/portal-padres/dashboard",
      });
    } catch (err) {
      console.error("Error en login:", err);
      setError("Error de conexión con el servidor. Intente nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  if (comprobando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800">
          <span className="animate-spin text-xl">⏳</span>
          <span className="font-bold text-sm">Verificando acceso familiar...</span>
        </div>
      </main>
    );
  }

  return (
    <>
      {transicionLogin && (
        <LoginTransition3D
          usuario={transicionLogin.usuario}
          tipoUsuario={transicionLogin.tipoUsuario}
          nombreEstudiante={transicionLogin.nombreEstudiante}
          rutaDestino={transicionLogin.rutaDestino}
        />
      )}
      <main className="min-h-screen flex items-center justify-center relative bg-slate-950 overflow-hidden p-4 sm:p-6">
      {/* Fondo con imagen institucional y degradado */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 scale-105"
        style={{ backgroundImage: "url('/img/colegio-santa-rita.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-red-950/50" />

      {/* Tarjeta de Inicio de Sesión */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Cabecera Granate / Oro */}
        <div className="bg-gradient-to-b from-slate-900 to-red-950 text-white p-8 text-center relative border-b-2 border-amber-400/60">
          <Link href="/" className="inline-block group mb-3">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-white p-1.5 shadow-xl ring-4 ring-amber-400/40 group-hover:ring-amber-400 transition transform group-hover:scale-105 duration-200">
              <Image
                src="/img/logo-santa-rita.png"
                alt="Escudo Santa Rita de Cassia"
                width={80}
                height={80}
                className="object-contain w-full h-full"
                priority
              />
            </div>
          </Link>

          <span className="inline-block text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/40 mb-2">
            Portal Oficial de Familias
          </span>

          <h1 className="text-2xl font-black tracking-tight text-white">
            I.E.P. Santa Rita de Cassia
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-normal">
            Consulta de Asistencia y Puntualidad Escolar · Cañete
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <span className="text-base leading-none">⚠️</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* DNI de la Alumna */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              1. DNI de su Hija (8 dígitos)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-slate-400">
                👩‍🎓
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                placeholder="Ingrese 8 dígitos de DNI"
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 text-sm font-semibold tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Si tiene más de una hija, ingrese el DNI de cualquiera de ellas.
            </p>
          </div>

          {/* Código Familiar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                2. Código Familiar Único
              </label>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Ej: SR-2026-XXXX
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-slate-400">
                🔐
              </span>
              <input
                type="text"
                value={codigoFamiliar}
                onChange={(e) => setCodigoFamiliar(e.target.value.toUpperCase())}
                placeholder="SR-2026-XXXX"
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 text-sm font-mono font-bold tracking-widest text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Código emitido por secretaría escolar para el grupo familiar.
            </p>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-4 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all duration-200 border border-amber-300 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {cargando ? (
              <>
                <span className="animate-spin text-base">⏳</span>
                <span>Comprobando acceso...</span>
              </>
            ) : (
              <>
                <span className="text-base">✨</span>
                <span>CONSULTAR ASISTENCIA</span>
              </>
            )}
          </button>

          {/* Enlace de regreso */}
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1"
            >
              <span>←</span>
              <span>Regresar al portal institucional</span>
            </Link>
          </div>
        </form>

        {/* Nota al pie */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[11px] text-slate-500">
          <p>
            ¿No cuenta con su Código Familiar? Solicítelo a través de la secretaría de la I.E.P. Santa Rita de Cassia.
          </p>
        </div>
      </div>
    </main>
    </>
  );
}
