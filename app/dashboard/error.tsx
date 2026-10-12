"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[CENTRO DE MONITOREO] Error en renderizado del Dashboard:", {
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack?.split("\n").slice(0, 4).join("\n"),
    });
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#07111f]/95 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-3xl">
          📊
        </div>

        <span className="mt-4 inline-block rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-400">
          Centro de Monitoreo Escolar
        </span>

        <h2 className="mt-3 text-xl font-black text-white">
          Sincronización del Dashboard Temporalmente Interrumpida
        </h2>

        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Ocurrió una pausa en la sincronización visual de los indicadores escolares.
          Los registros de asistencia en PostgreSQL se encuentran seguros e intactos.
        </p>

        {error?.digest && (
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            Código de seguimiento: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition active:scale-95"
          >
            🔄 Reintentar sincronización
          </button>

          <Link
            href="/dashboard/supermotor"
            className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3 text-sm font-black text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            ⚡ Ir a SuperMotor
          </Link>
        </div>
      </div>
    </div>
  );
}
