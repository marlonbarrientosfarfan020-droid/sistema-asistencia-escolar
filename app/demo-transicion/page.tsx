"use client";

import { useState } from "react";
import LoginTransition3D from "@/components/LoginTransition3D";

export default function DemoTransicionPage() {
  const [modo, setModo] = useState<"control" | "familia">("control");
  const [duracion, setDuracion] = useState<number>(6);
  const [contadorKey, setContadorKey] = useState<number>(0);

  const reiniciar = () => {
    setContadorKey((prev) => prev + 1);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Barra de control flotante para pruebas interactivas */}
      <aside aria-label="Controles de simulación 3D" className="absolute top-2 left-1/2 -translate-x-1/2 z-[100000] flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.3)]">
        <span className="text-[10px] sm:text-xs font-black text-cyan-300 tracking-wider uppercase">
          DEMO ESCUDO 3D:
        </span>

        <button
          type="button"
          onClick={() => {
            setModo("control");
            reiniciar();
          }}
          className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all ${
            modo === "control"
              ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Centro de Control
        </button>

        <button
          type="button"
          onClick={() => {
            setModo("familia");
            reiniciar();
          }}
          className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all ${
            modo === "familia"
              ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Familia Santa Rita
        </button>

        <div className="h-3 w-[1px] bg-white/20" />

        <button
          type="button"
          onClick={() => {
            setDuracion((prev) => (prev === 6 ? 30 : 6));
            reiniciar();
          }}
          className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition"
        >
          ⏱️ {duracion}s
        </button>

        <button
          type="button"
          onClick={reiniciar}
          className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-black bg-amber-500/80 hover:bg-amber-400 text-slate-950 transition active:scale-95"
        >
          🔄 Reiniciar
        </button>
      </aside>

      {/* Renderizado de la Transición 3D */}
      <LoginTransition3D
        key={`${modo}-${duracion}-${contadorKey}`}
        usuario={modo === "control" ? "Ingeniero de Sistema" : "Dulio Jacinto"}
        tipoUsuario={modo === "control" ? "ADMINISTRADOR" : "FAMILIA / APODERADO"}
        nombreEstudiante={modo === "control" ? undefined : "Familia de Jacinto"}
        rutaDestino={modo === "control" ? "/dashboard" : "/portal-padres/dashboard"}
        duracionSegundos={duracion}
        onComplete={() => {
          console.log("Transición 3D completada!");
        }}
      />
    </div>
  );
}
