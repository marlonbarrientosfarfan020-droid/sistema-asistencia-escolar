"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("[SISTEMA ASISTENCIA ESCOLAR] Error de aplicación:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-3xl">
          🏫
        </div>

        <h1 className="mt-4 text-xl font-black text-white">
          I.E.P. Santa Rita de Cassia
        </h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          Sistema Inteligente de Asistencia Escolar
        </p>

        <p className="mt-4 text-sm text-slate-300 leading-relaxed">
          Se ha presentado una interrupción momentánea en la interfaz. Por favor presione reintentar para restablecer la conexión.
        </p>

        {error?.digest && (
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            ID de incidencia: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition active:scale-95"
          >
            🔄 Reintentar
          </button>

          <Link
            href="/"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-black text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            🏠 Ir a Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
