"use client";

import React, { useState, useEffect } from "react";

export function HeroStorytellingAnimation() {
  const [escenaActiva, setEscenaActiva] = useState<number>(1);
  const [estaPausado, setEstaPausado] = useState<boolean>(false);
  const [progreso, setProgreso] = useState<number>(0);

  const duracionEscenaMs = 4000;

  // Ciclo automático de escenas
  useEffect(() => {
    if (estaPausado) return;

    const tiempoInicio = Date.now();
    const frameInterval = setInterval(() => {
      const tiempoTranscurrido = Date.now() - tiempoInicio;
      const pct = Math.min(100, (tiempoTranscurrido / duracionEscenaMs) * 100);
      setProgreso(pct);

      if (tiempoTranscurrido >= duracionEscenaMs) {
        setProgreso(0);
        setEscenaActiva((prev) => (prev % 5) + 1);
      }
    }, 50);

    return () => clearInterval(frameInterval);
  }, [escenaActiva, estaPausado]);

  const irAEscena = (num: number) => {
    setEscenaActiva(num);
    setProgreso(0);
  };

  const escenasInfo = [
    { num: 1, label: "Llegada", icon: "🏫" },
    { num: 2, label: "Escaneo QR", icon: "📱" },
    { num: 3, label: "Foto Portería", icon: "📷" },
    { num: 4, label: "Procesamiento IA", icon: "⚡" },
    { num: 5, label: "Notificación Padres", icon: "📲" },
  ];

  return (
    <div className="relative w-full max-w-lg lg:max-w-xl mx-auto rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-red-950/40 p-3.5 sm:p-5 border border-amber-500/30 shadow-2xl shadow-red-950/50 backdrop-blur-xl flex flex-col justify-between overflow-hidden">
      {/* Luz ambiental decorativa */}
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Cabecera de la Animación */}
      <div className="relative z-10 flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-400">
            Paso {escenaActiva} de 5 · Flujo en Vivo
          </span>
        </div>

        <button
          type="button"
          onClick={() => setEstaPausado(!estaPausado)}
          className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 border border-slate-700/50"
          title={estaPausado ? "Reanudar animación" : "Pausar animación"}
        >
          <span>{estaPausado ? "▶ Reanudar" : "⏸ Pausar"}</span>
        </button>
      </div>

      {/* Barra de Progreso de la Escena Actual */}
      <div className="relative z-10 w-full h-1 bg-slate-800/80 rounded-full my-1.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-red-500 to-amber-300 transition-all duration-75 ease-linear rounded-full"
          style={{ width: `${progreso}%` }}
        />
      </div>

      {/* Escenario de Animación 2D (SVG + Micro-animaciones) */}
      <div className="relative z-10 my-1.5 h-48 sm:h-56 md:h-60 w-full flex items-center justify-center rounded-2xl bg-slate-950/70 border border-slate-800/80 overflow-hidden p-2.5 sm:p-4">
        {/* ================= ESCENA 1: LLEGADA AL COLEGIO ================= */}
        {escenaActiva === 1 && (
          <div className="w-full h-full flex flex-col items-center justify-between text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-200 text-xs font-bold">
              <span>🏫</span>
              <span>I.E.P. Santa Rita de Cassia · Ingreso Matutino</span>
            </div>

            {/* Ilustración Vectorial */}
            <div className="relative w-full max-w-[280px] h-36 flex items-end justify-center">
              <svg viewBox="0 0 300 160" className="w-full h-full drop-shadow-md">
                <defs>
                  <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <linearGradient id="gateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B0000" />
                    <stop offset="100%" stopColor="#450a0a" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="300" height="160" rx="12" fill="url(#skyGrad)" />
                <circle cx="250" cy="40" r="20" fill="#F59E0B" opacity="0.3" className="animate-pulse" />
                <circle cx="250" cy="40" r="14" fill="#FBBF24" opacity="0.8" />

                {/* Edificio de la Escuela */}
                <rect x="40" y="55" width="220" height="85" rx="4" fill="#1e1e2d" stroke="#334155" strokeWidth="1.5" />
                <polygon points="30,55 150,20 270,55" fill="url(#gateGrad)" stroke="#b91c1c" strokeWidth="1.5" />

                {/* Letrero Escolar */}
                <rect x="75" y="38" width="150" height="16" rx="4" fill="#0f172a" stroke="#D4AF37" strokeWidth="1" />
                <text x="150" y="49" textAnchor="middle" fill="#FDE68A" fontSize="7.5" fontWeight="bold" letterSpacing="1">
                  SANTA RITA DE CASSIA
                </text>

                {/* Puerta Principal / Portería */}
                <rect x="125" y="85" width="50" height="55" rx="2" fill="#2d1515" stroke="#991B1B" strokeWidth="1.5" />
                <rect x="130" y="90" width="40" height="50" rx="1" fill="#180b0b" />
                <line x1="150" y1="90" x2="150" y2="140" stroke="#991b1b" strokeWidth="1" />

                {/* Ventanas */}
                <rect x="60" y="70" width="22" height="20" rx="2" fill="#38bdf8" opacity="0.4" />
                <rect x="92" y="70" width="22" height="20" rx="2" fill="#38bdf8" opacity="0.4" />
                <rect x="186" y="70" width="22" height="20" rx="2" fill="#38bdf8" opacity="0.4" />
                <rect x="218" y="70" width="22" height="20" rx="2" fill="#38bdf8" opacity="0.4" />

                {/* Piso */}
                <rect x="0" y="140" width="300" height="20" fill="#0f172a" />
                <line x1="0" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
              </svg>

              {/* Estudiante con Mochila */}
              <div className="absolute left-8 bottom-3 sm:bottom-4 animate-bounce">
                <div className="relative flex flex-col items-center">
                  <div className="w-5 h-5 rounded-full bg-amber-200 border-2 border-amber-400 shadow-sm" />
                  <div className="w-4 h-7 bg-red-800 rounded-md mt-0.5 relative">
                    <div className="absolute -left-2 top-1 w-2.5 h-5 bg-amber-500 rounded-sm" />
                  </div>
                  <div className="flex gap-1 -mt-0.5">
                    <div className="w-1.5 h-4 bg-slate-700 rounded-sm" />
                    <div className="w-1.5 h-4 bg-slate-700 rounded-sm" />
                  </div>
                </div>
              </div>

              {/* Flecha indicadora */}
              <div className="absolute left-24 bottom-9 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black tracking-tight shadow-md flex items-center gap-1 animate-pulse">
                <span>07:40 AM</span>
                <span>➜ Ingresando</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-medium">
              <strong className="text-amber-300 font-bold">1. Llegada de la estudiante:</strong> Puntualidad, disciplina y bienvenida en portería escolar.
            </div>
          </div>
        )}

        {/* ================= ESCENA 2: ESCANEO QR ================= */}
        {escenaActiva === 2 && (
          <div className="w-full h-full flex flex-col items-center justify-between text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-700/60 text-amber-200 text-xs font-bold">
              <span>📱</span>
              <span>Lector Óptico de Carné Escolar</span>
            </div>

            {/* Fotocheck y Escáner Láser */}
            <div className="relative w-56 h-36 flex items-center justify-center">
              <div className="relative w-36 h-28 rounded-xl bg-gradient-to-b from-white to-slate-100 p-2 text-slate-900 shadow-xl border-2 border-amber-400/80 flex flex-col items-center justify-between">
                <div className="w-6 h-1.5 rounded-full bg-slate-300 mb-1" />

                <div className="text-center w-full">
                  <span className="block text-[8px] font-black text-red-800 uppercase tracking-tighter">
                    I.E.P. Santa Rita
                  </span>
                  <span className="block text-[7px] text-slate-500 font-bold">
                    Estudiante Secundaria
                  </span>
                </div>

                <div className="relative w-14 h-14 bg-white p-1 rounded-md border border-slate-300 shadow-inner flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-full h-full text-slate-900">
                    <rect x="2" y="2" width="6" height="6" fill="currentColor" />
                    <rect x="3.5" y="3.5" width="3" height="3" fill="white" />
                    <rect x="16" y="2" width="6" height="6" fill="currentColor" />
                    <rect x="17.5" y="3.5" width="3" height="3" fill="white" />
                    <rect x="2" y="16" width="6" height="6" fill="currentColor" />
                    <rect x="3.5" y="17.5" width="3" height="3" fill="white" />
                    <rect x="10" y="4" width="4" height="2" fill="currentColor" />
                    <rect x="10" y="10" width="4" height="4" fill="currentColor" />
                    <rect x="16" y="12" width="3" height="3" fill="currentColor" />
                    <rect x="4" y="10" width="3" height="3" fill="currentColor" />
                    <rect x="12" y="16" width="4" height="4" fill="currentColor" />
                    <rect x="18" y="18" width="4" height="4" fill="currentColor" />
                  </svg>
                  <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-bounce" />
                </div>

                <span className="text-[7px] font-mono font-bold text-slate-700">
                  DNI: 74829103
                </span>
              </div>

              <div className="absolute -bottom-2 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-black shadow-lg flex items-center gap-1.5 animate-pulse">
                <span>✅</span>
                <span>Asistencia Registrada</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-medium">
              <strong className="text-emerald-400 font-bold">2. Lectura QR:</strong> Reconocimiento de credencial en menos de 1 segundo en portería.
            </div>
          </div>
        )}

        {/* ================= ESCENA 3: CAPTURA FOTOGRÁFICA ================= */}
        {escenaActiva === 3 && (
          <div className="w-full h-full flex flex-col items-center justify-between text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/70 border border-sky-700/60 text-sky-200 text-xs font-bold">
              <span>📷</span>
              <span>Cámara de Seguridad en Portería</span>
            </div>

            <div className="relative w-64 h-36 flex items-center justify-center">
              <div className="relative w-48 h-32 rounded-2xl bg-slate-900 border-2 border-sky-400/80 p-2 shadow-2xl flex flex-col justify-between overflow-hidden">
                <div className="absolute inset-0 bg-white/20 animate-ping pointer-events-none" />

                <div className="flex justify-between text-sky-400 text-[10px] font-mono">
                  <span>┌ [REC]</span>
                  <span>┐ LIVE</span>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-800 to-amber-600 flex items-center justify-center text-xl shadow-inner border border-amber-300">
                    👧
                  </div>
                  <span className="text-[9px] font-bold text-slate-200 mt-1">
                    Valeria F. (3° &quot;A&quot;)
                  </span>
                  <span className="text-[8px] font-mono text-emerald-400">
                    07:42:15 AM · Portería 1
                  </span>
                </div>

                <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono">
                  <span>└ ISO 400</span>
                  <span className="text-amber-400 font-bold">Vercel Blob ☁</span>
                  <span>┘</span>
                </div>
              </div>

              <div className="absolute -bottom-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg flex items-center gap-1.5">
                <span>📷</span>
                <span>Foto guardada correctamente</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-medium">
              <strong className="text-sky-300 font-bold">3. Evidencia visual:</strong> Fotografía automática sincronizada con almacenamiento seguro en la nube.
            </div>
          </div>
        )}

        {/* ================= ESCENA 4: FLUJO DE DATOS IA Y SERVIDOR ================= */}
        {escenaActiva === 4 && (
          <div className="w-full h-full flex flex-col items-center justify-between text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-700/60 text-indigo-200 text-xs font-bold">
              <span>⚡</span>
              <span>Procesamiento en Servidores y Red</span>
            </div>

            <div className="relative w-full max-w-sm h-36 flex items-center justify-between px-2">
              {/* Nodo 1: Estudiante */}
              <div className="flex flex-col items-center z-10">
                <div className="w-11 h-11 rounded-2xl bg-red-950 border border-red-500 flex items-center justify-center text-lg shadow-lg shadow-red-500/20">
                  👩‍🎓
                </div>
                <span className="text-[9px] font-bold text-slate-300 mt-1">Estudiante</span>
              </div>

              <div className="flex-1 h-0.5 bg-slate-700 relative mx-1">
                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>

              {/* Nodo 2: Servidor / IA */}
              <div className="flex flex-col items-center z-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-950 border-2 border-indigo-400 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 animate-pulse">
                  🤖
                </div>
                <span className="text-[9px] font-bold text-indigo-300 mt-1">Sistema IA</span>
              </div>

              <div className="flex-1 h-0.5 bg-slate-700 relative mx-1">
                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              </div>

              {/* Nodo 3: Estadísticas */}
              <div className="flex flex-col items-center z-10">
                <div className="w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-500 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">
                  📊
                </div>
                <span className="text-[9px] font-bold text-slate-300 mt-1">Métricas</span>
              </div>

              <div className="flex-1 h-0.5 bg-slate-700 relative mx-1">
                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>

              {/* Nodo 4: Familia */}
              <div className="flex flex-col items-center z-10">
                <div className="w-11 h-11 rounded-2xl bg-amber-950 border border-amber-400 flex items-center justify-center text-lg shadow-lg shadow-amber-500/20">
                  👨‍👩‍👧
                </div>
                <span className="text-[9px] font-bold text-amber-300 mt-1">Familia</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-medium">
              <strong className="text-indigo-300 font-bold">4. Sincronización instantánea:</strong> La asistencia consolida las métricas escolares y notifica al hogar.
            </div>
          </div>
        )}

        {/* ================= ESCENA 5: NOTIFICACIÓN EN CELULAR ================= */}
        {escenaActiva === 5 && (
          <div className="w-full h-full flex flex-col items-center justify-between text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs font-bold">
              <span>📲</span>
              <span>Recepción en Teléfono de los Padres</span>
            </div>

            <div className="relative w-64 h-36 flex items-center justify-center">
              <div className="w-56 bg-slate-900 rounded-2xl p-2.5 border-2 border-slate-700 shadow-2xl text-left">
                <div className="flex justify-center mb-1.5">
                  <div className="w-12 h-1 bg-slate-700 rounded-full" />
                </div>

                <div className="bg-gradient-to-r from-slate-800 to-slate-850 p-2.5 rounded-xl border border-amber-400/50 shadow-lg">
                  <div className="flex items-center justify-between text-[8px] text-amber-400 font-black uppercase">
                    <span className="flex items-center gap-1">
                      <span>🌹</span> Santa Rita de Cassia
                    </span>
                    <span className="text-slate-400 font-mono">Ahora</span>
                  </div>

                  <p className="text-[10px] font-black text-white mt-1">
                    Asistencia de mi hija registrada
                  </p>

                  <div className="mt-1.5 flex items-center justify-between bg-slate-950/70 p-1.5 rounded-lg border border-slate-800 text-[9px]">
                    <div>
                      <span className="text-slate-400 block text-[7px] uppercase font-bold">Entrada</span>
                      <strong className="text-white font-mono">07:42 AM</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[7px] uppercase font-bold">Estado</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Puntual
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-medium">
              <strong className="text-emerald-400 font-bold">5. Tranquilidad en casa:</strong> Papá y mamá confirmando la llegada segura de su hija.
            </div>
          </div>
        )}
      </div>

      {/* Selector de Escenas Interactivo */}
      <div className="relative z-10 pt-2 grid grid-cols-5 gap-1.5">
        {escenasInfo.map((esc) => {
          const esActiva = esc.num === escenaActiva;
          return (
            <button
              key={esc.num}
              type="button"
              onClick={() => irAEscena(esc.num)}
              className={`py-1.5 px-1 rounded-xl text-center transition flex flex-col items-center justify-center gap-0.5 border ${
                esActiva
                  ? "bg-gradient-to-r from-amber-500 to-red-600 text-white font-black border-amber-300 shadow-md scale-105"
                  : "bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800 text-[10px]"
              }`}
            >
              <span className="text-xs">{esc.icon}</span>
              <span className="text-[9px] font-bold leading-none hidden sm:inline">
                {esc.label}
              </span>
              <span className="text-[9px] font-bold leading-none sm:hidden">
                {esc.num}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
