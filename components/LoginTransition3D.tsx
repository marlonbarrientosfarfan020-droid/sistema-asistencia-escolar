"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Escudo3DCanvas from "./Escudo3DCanvas";

export interface LoginTransition3DProps {
  usuario: string;
  tipoUsuario?: string;
  rutaDestino: string;
  nombreEstudiante?: string;
  duracionSegundos?: number;
  onComplete?: () => void;
}

export default function LoginTransition3D({
  usuario,
  tipoUsuario = "ADMINISTRATIVO",
  rutaDestino,
  nombreEstudiante,
  duracionSegundos = 6,
  onComplete,
}: LoginTransition3DProps) {
  const router = useRouter();
  const [progreso, setProgreso] = useState(6);
  const [faseTexto, setFaseTexto] = useState(0);
  const [desvanecerSalida, setDesvanecerSalida] = useState(false);

  const esPadre = tipoUsuario === "FAMILIA" || tipoUsuario === "PADRE" || Boolean(nombreEstudiante);

  const textosEstado = [
    {
      titulo: (
        <>
          Iniciando tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">sesión...</span>
        </>
      ),
      subtexto: "Conectando con el sistema de asistencia escolar",
    },
    {
      titulo: (
        <>
          Iniciando tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">sesión...</span>
        </>
      ),
      subtexto: "Validando credenciales institucionales y seguridad 360°...",
    },
    {
      titulo: (
        <>
          ¡Acceso <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Autorizado!</span>
        </>
      ),
      subtexto: "Cargando registros escolares en tiempo real...",
    },
    {
      titulo: (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">
          {esPadre ? "¡Bienvenido a la Familia Santa Rita!" : "Bienvenido al Centro de Control Escolar"}
        </span>
      ),
      subtexto: esPadre
        ? `Portal oficial para la ${nombreEstudiante || `Familia de ${usuario}`}`
        : "Acceso verificado exitosamente · Abriendo panel de control...",
    },
  ];

  useEffect(() => {
    // 0. Prefetch de la ruta de destino para carga instantánea
    if (rutaDestino) {
      router.prefetch(rutaDestino);
    }

    // 1. Barra de progreso fluida de 0% a 100%
    const totalMs = duracionSegundos * 1000;
    const startTime = performance.now();

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(Math.round((elapsed / (totalMs - 350)) * 100), 100);
      setProgreso(pct);

      if (pct >= 100) {
        clearInterval(interval);
      }
    }, 45);

    // 2. Fases dinámicas de texto
    const t1 = setTimeout(() => setFaseTexto(1), totalMs * 0.28);
    const t2 = setTimeout(() => setFaseTexto(2), totalMs * 0.58);
    const t3 = setTimeout(() => setFaseTexto(3), totalMs * 0.78); // "Bienvenido al Centro de Control Escolar"

    // 3. Desvanecimiento suave al finalizar (solo cuando se utiliza callback manual onComplete)
    let tSalida: NodeJS.Timeout | null = null;
    if (onComplete) {
      tSalida = setTimeout(() => {
        setDesvanecerSalida(true);
      }, totalMs - 450);
    }

    // 4. Redirección final
    const tFin = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        router.replace(rutaDestino);
      }
    }, totalMs);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (tSalida) clearTimeout(tSalida);
      clearTimeout(tFin);
    };
  }, [duracionSegundos, onComplete, router, rutaDestino]);

  const subtituloHeader =
    nombreEstudiante ||
    (esPadre
      ? `Familia de ${usuario}`
      : `${usuario} · ${tipoUsuario}`);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col justify-between overflow-hidden bg-[#030a16] text-white select-none transition-all duration-500 ${
        desvanecerSalida ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        backgroundImage: "radial-gradient(ellipse at center, rgba(10, 34, 64, 0.72) 0%, rgba(3, 10, 22, 0.94) 75%, #02060f 100%), url('/img/login-transition-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* CAPA DE AMBIENTE CINEMATOGRÁFICO Y RESPLANDOR */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Haz de luz central vertical hacia el pedestal */}
        <div className="absolute left-1/2 bottom-[20%] -translate-x-1/2 w-[220px] sm:w-[320px] h-[550px] bg-gradient-to-t from-cyan-400/30 via-blue-500/15 to-transparent blur-3xl rounded-full" />
        
        {/* Resplandores ambientales en las esquinas */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-600/15 blur-[100px] rounded-full" />
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-amber-500/15 blur-[120px] rounded-full" />
        <div className="absolute -bottom-20 left-1/3 w-[450px] h-60 bg-cyan-500/15 blur-[90px] rounded-full" />

        {/* Partículas de luz CSS */}
        <div className="particula-css p1" />
        <div className="particula-css p2" />
        <div className="particula-css p3" />
        <div className="particula-css p4" />
      </div>

      {/* ======================================================== */}
      {/* 1. HEADER SUPERIOR INSTITUCIONAL                         */}
      {/* ======================================================== */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 sm:px-12 sm:py-5 backdrop-blur-md bg-slate-950/30 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-11 sm:w-11 sm:h-13 shrink-0 drop-shadow-[0_0_12px_rgba(234,179,8,0.5)]">
            <Image
              src="/img/logo-santa-rita.png"
              alt="Insignia Santa Rita de Cassia"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h2 className="text-xs sm:text-base font-black tracking-wider text-white uppercase drop-shadow">
              SANTA RITA DE CASSIA
            </h2>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-300/85">
              {subtituloHeader}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[9px] sm:text-xs font-black tracking-[0.2em] sm:tracking-[0.25em] text-slate-300/90 uppercase">
            EDUCACIÓN &bull; DISCIPLINA &bull; FUTURO
          </p>
          <div className="mt-1 h-0.5 w-10 sm:w-12 ml-auto rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. ESCENARIO CENTRAL: ESCUDO 3D THREE.JS + ESTADO        */}
      {/* ======================================================== */}
      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-1 sm:py-3 my-auto overflow-visible">
        <div className="relative flex flex-col items-center justify-center w-full max-w-lg">
          
          {/* Contenedor 3D del Escudo de Santa Rita */}
          <div className="relative w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] flex items-center justify-center">
            
            {/* Resplandor áureo dinámico detrás del escudo */}
            <div className="absolute inset-0 m-auto w-44 h-44 sm:w-60 sm:h-60 rounded-full bg-gradient-to-tr from-amber-400/20 via-yellow-200/15 to-cyan-400/20 blur-3xl animate-pulse pointer-events-none" />

            {/* CANVAS 3D REAL (THREE.JS) CON VOLUMETRÍA, ORO Y GIRO 360° */}
            <Escudo3DCanvas className="w-full h-full z-10" progreso={progreso} />

            {/* BADGE FLOTANTE "360°" EXACTO AL DISEÑO */}
            <div className="absolute right-0 sm:-right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-950/70 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.3)] pointer-events-none animate-in fade-in zoom-in duration-500">
              <span className="text-[10px] sm:text-xs font-black text-white tracking-widest drop-shadow">
                360°
              </span>
              <svg
                className="w-4 h-2.5 sm:w-5 sm:h-3 text-cyan-400 animate-pulse"
                fill="none"
                viewBox="0 0 24 12"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9c3.5-4 14.5-4 18 0m-3-4l3 4-4 2" />
              </svg>
            </div>

            {/* Base holográfica de luz en el suelo del pedestal */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-56 sm:w-72 h-14 pointer-events-none">
              <div className="w-full h-full rounded-full border border-cyan-400/50 bg-gradient-to-t from-cyan-500/25 to-transparent shadow-[0_0_35px_rgba(6,182,212,0.5)] [transform:rotateX(75deg)]" />
              <div className="absolute inset-x-5 top-2 h-8 rounded-full border border-blue-400/60 [transform:rotateX(75deg)] animate-ping opacity-40" />
            </div>
          </div>

          {/* Textos de Estado con Animación de Transición */}
          <div className="mt-4 sm:mt-6 text-center px-3 min-h-[70px] sm:min-h-[85px] flex flex-col items-center justify-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight transition-all duration-300">
              {textosEstado[faseTexto].titulo}
            </h1>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-slate-300/90 max-w-md mx-auto transition-all duration-300">
              {textosEstado[faseTexto].subtexto}
            </p>
          </div>

          {/* Barra de Progreso Neón con Porcentaje */}
          <div className="mt-3 sm:mt-4 w-full max-w-[260px] sm:max-w-sm flex items-center gap-3">
            <div className="relative flex-1 h-2 sm:h-2.5 rounded-full bg-slate-950/80 border border-cyan-400/30 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] backdrop-blur-sm p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-all duration-100 ease-out shadow-[0_0_14px_rgba(6,182,212,0.8)]"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <span className="text-xs sm:text-sm font-black text-cyan-300 tabular-nums w-11 text-right drop-shadow font-mono">
              {progreso}%
            </span>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* 3. FOOTER CON 4 TARJETAS INSTITUCIONALES                 */}
      {/* ======================================================== */}
      <footer className="relative z-20 px-3 py-3 sm:px-6 sm:py-5 backdrop-blur-md bg-slate-950/40 border-t border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3.5">
          <TarjetaIcono
            icono="🛡️"
            titulo="Seguridad"
            subtitulo="en cada acceso"
            bordeColor="border-cyan-500/30 hover:border-cyan-400/60"
            glowColor="from-cyan-500/20"
          />
          <TarjetaIcono
            icono="👥"
            titulo="Compromiso"
            subtitulo="con la educación"
            bordeColor="border-blue-500/30 hover:border-blue-400/60"
            glowColor="from-blue-500/20"
          />
          <TarjetaIcono
            icono="📊"
            titulo="Tecnología"
            subtitulo="para tu futuro"
            bordeColor="border-amber-500/30 hover:border-amber-400/60"
            glowColor="from-amber-500/20"
          />
          <TarjetaIcono
            icono="💙"
            titulo="Una gran familia"
            subtitulo="Santa Rita de Cassia"
            bordeColor="border-red-500/30 hover:border-red-400/60"
            glowColor="from-red-500/20"
          />
        </div>

        <div className="mt-2.5 sm:mt-3.5 text-center">
          <p className="text-[9px] sm:text-xs font-black tracking-[0.25em] sm:tracking-[0.3em] text-slate-400/90 uppercase">
            &ldquo;DISCIPLINA HOY, GRANDES LOGROS MAÑANA&rdquo;
          </p>
          <div className="mt-1 h-0.5 w-14 sm:w-16 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
        </div>
      </footer>

      {/* ESTILOS DE PARTÍCULAS CSS */}
      <style jsx>{`
        .particula-css {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, #38bdf8 0%, rgba(56, 189, 248, 0) 70%);
          pointer-events: none;
          filter: blur(1px);
        }
        .p1 {
          width: 5px;
          height: 5px;
          left: 18%;
          bottom: 25%;
          animation: flotarParticula 4s ease-in-out infinite;
        }
        .p2 {
          width: 7px;
          height: 7px;
          left: 45%;
          bottom: 35%;
          animation: flotarParticula 5s ease-in-out infinite 1s;
        }
        .p3 {
          width: 5px;
          height: 5px;
          right: 22%;
          bottom: 22%;
          animation: flotarParticula 4.5s ease-in-out infinite 2s;
        }
        .p4 {
          width: 6px;
          height: 6px;
          right: 38%;
          bottom: 32%;
          animation: flotarParticula 6s ease-in-out infinite 0.5s;
        }

        @keyframes flotarParticula {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-45px) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-90px) scale(0.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function TarjetaIcono({
  icono,
  titulo,
  subtitulo,
  bordeColor,
  glowColor,
}: {
  icono: string;
  titulo: string;
  subtitulo: string;
  bordeColor: string;
  glowColor: string;
}) {
  return (
    <div
      className={`group flex flex-col items-center justify-center p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-900/60 border ${bordeColor} backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-[1.02]`}
    >
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-tr ${glowColor} to-transparent flex items-center justify-center text-base sm:text-xl shadow-inner border border-white/10`}
      >
        {icono}
      </div>
      <p className="mt-1.5 text-[11px] sm:text-xs md:text-sm font-black text-white text-center leading-tight">
        {titulo}
      </p>
      <p className="text-[9px] sm:text-[10px] md:text-[11px] font-medium text-slate-400 text-center leading-tight mt-0.5">
        {subtitulo}
      </p>
    </div>
  );
}
