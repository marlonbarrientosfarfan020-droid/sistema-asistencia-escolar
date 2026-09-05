"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  const [progreso, setProgreso] = useState(5);
  const [faseTexto, setFaseTexto] = useState(0);
  const [desvanecerSalida, setDesvanecerSalida] = useState(false);

  const textosEstado = [
    { texto: "Iniciando tu sesión...", subtexto: "Verificando credenciales institucionales..." },
    { texto: "Iniciando tu sesión...", subtexto: "Cargando módulo de asistencia escolar..." },
    { texto: "Iniciando tu sesión...", subtexto: "Preparando panel institucional inteligente..." },
    { texto: "¡Acceso autorizado!", subtexto: "Bienvenido al Sistema de Asistencia Escolar" },
  ];

  useEffect(() => {
    // Incremento de la barra de progreso
    const intervaloProgreso = setInterval(() => {
      setProgreso((prev) => {
        if (prev >= 100) {
          clearInterval(intervaloProgreso);
          return 100;
        }
        const delta = Math.floor(Math.random() * 4) + 2;
        return Math.min(prev + delta, 100);
      });
    }, (duracionSegundos * 1000) / 45);

    // Cambios de estado de texto
    const t1 = setTimeout(() => setFaseTexto(1), (duracionSegundos * 1000) * 0.25);
    const t2 = setTimeout(() => setFaseTexto(2), (duracionSegundos * 1000) * 0.55);
    const t3 = setTimeout(() => setFaseTexto(3), (duracionSegundos * 1000) * 0.85);

    // Desvanecimiento de salida antes de redirigir
    const tSalida = setTimeout(() => {
      setDesvanecerSalida(true);
    }, (duracionSegundos * 1000) - 400);

    // Redirección final
    const tFin = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        router.replace(rutaDestino);
        router.refresh();
      }
    }, duracionSegundos * 1000);

    return () => {
      clearInterval(intervaloProgreso);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tSalida);
      clearTimeout(tFin);
    };
  }, [duracionSegundos, onComplete, router, rutaDestino]);

  const subtituloHeader =
    nombreEstudiante ||
    (tipoUsuario === "FAMILIA" || tipoUsuario === "PADRE"
      ? `Familia de ${usuario}`
      : `${usuario} · ${tipoUsuario}`);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col justify-between overflow-hidden bg-[#030a16] text-white select-none transition-opacity duration-500 ${
        desvanecerSalida ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        backgroundImage: "radial-gradient(ellipse at center, rgba(10, 34, 64, 0.7) 0%, rgba(3, 10, 22, 0.95) 75%, #02060f 100%), url('/img/login-transition-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* CAPA DE AMBIENTE CINEMATOGRÁFICO Y PARTÍCULAS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Haz de luz central vertical */}
        <div className="absolute left-1/2 bottom-[25%] -translate-x-1/2 w-[240px] h-[580px] bg-gradient-to-t from-cyan-400/35 via-blue-500/15 to-transparent blur-3xl rounded-full" />
        
        {/* Resplandor rojo institucional y dorado en las esquinas */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-600/15 blur-[120px] rounded-full" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-amber-500/10 blur-[130px] rounded-full" />
        <div className="absolute -bottom-20 left-1/4 w-[500px] h-64 bg-cyan-600/20 blur-[100px] rounded-full" />

        {/* Partículas flotantes de luz */}
        <div className="particula p1" />
        <div className="particula p2" />
        <div className="particula p3" />
        <div className="particula p4" />
        <div className="particula p5" />
        <div className="particula p6" />
      </div>

      {/* 1. HEADER SUPERIOR */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-12 sm:py-6 backdrop-blur-sm bg-slate-950/20 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-12 shrink-0 drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]">
            <Image
              src="/img/logo-santa-rita.png"
              alt="Insignia Santa Rita de Cassia"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-wider text-white uppercase drop-shadow">
              SANTA RITA DE CASSIA
            </h2>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-300/80">
              {subtituloHeader}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-slate-300/90 uppercase">
            EDUCACIÓN &bull; DISCIPLINA &bull; FUTURO
          </p>
          <div className="mt-1 h-0.5 w-12 ml-auto rounded-full bg-gradient-to-r from-cyan-400 to-blue-600" />
        </div>
      </header>

      {/* 2. ESCENARIO CENTRAL 3D */}
      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-2 my-auto">
        <div className="relative flex flex-col items-center justify-center w-full max-w-lg">
          
          {/* Contenedor con Perspectiva 3D */}
          <div className="relative w-[280px] h-[300px] sm:w-[320px] sm:h-[340px] flex items-center justify-center [perspective:1400px]">
            
            {/* Anillos Holográficos en Órbita 3D */}
            <div className="anillo-holografico-azul" />
            <div className="anillo-holografico-dorado" />

            {/* Resplandor áureo detrás del escudo */}
            <div className="absolute inset-0 m-auto w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-amber-400/25 via-yellow-200/20 to-cyan-400/25 blur-2xl animate-pulse" />

            {/* Escudo 3D con Rotación 360° en el Eje Y */}
            <div className="escudo-3d-wrapper">
              <div className="escudo-3d-rotador">
                <div className="relative w-[210px] h-[250px] sm:w-[240px] sm:h-[290px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)] filter">
                  <Image
                    src="/img/escudo-3d-gold.png"
                    alt="Escudo 3D Santa Rita de Cassia"
                    fill
                    sizes="(max-width: 640px) 210px, 240px"
                    className="object-contain pointer-events-none drop-shadow-[0_0_25px_rgba(234,179,8,0.5)]"
                    priority
                  />
                  {/* Destello de brillo metálico que barre el escudo */}
                  <div className="brillo-especular" />
                </div>
              </div>
            </div>

            {/* Indicador Flotante 360° */}
            <div className="absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 backdrop-blur-md shadow-lg pointer-events-none animate-in fade-in duration-700">
              <span className="text-xs font-black text-white tracking-widest">360°</span>
              <svg
                className="w-5 h-3 text-cyan-400 animate-pulse"
                fill="none"
                viewBox="0 0 24 12"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9c3.5-4 14.5-4 18 0m-3-4l3 4-4 2" />
              </svg>
            </div>

            {/* Base / Plataforma tecnológica en el suelo */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-64 h-16 pointer-events-none">
              <div className="w-full h-full rounded-full border border-cyan-400/40 bg-gradient-to-t from-cyan-500/20 to-transparent shadow-[0_0_30px_rgba(6,182,212,0.4)] [transform:rotateX(75deg)]" />
              <div className="absolute inset-x-6 top-3 h-10 rounded-full border border-blue-400/50 [transform:rotateX(75deg)] animate-ping" />
            </div>
          </div>

          {/* Textos de Estado de Bienvenida */}
          <div className="mt-8 text-center px-4">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Iniciando tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">sesión...</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm font-medium text-slate-300/85 max-w-md mx-auto transition-all duration-300">
              {textosEstado[faseTexto].subtexto}
            </p>
          </div>

          {/* Barra de Progreso Neón */}
          <div className="mt-5 w-full max-w-xs sm:max-w-sm flex items-center gap-3">
            <div className="relative flex-1 h-2 sm:h-2.5 rounded-full bg-slate-900/80 border border-white/10 overflow-hidden shadow-inner backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(6,182,212,0.7)]"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <span className="text-xs sm:text-sm font-black text-cyan-300 tabular-nums w-10 text-right drop-shadow">
              {progreso}%
            </span>
          </div>
        </div>
      </main>

      {/* 3. FOOTER CON 4 TARJETAS INSTITUCIONALES */}
      <footer className="relative z-20 px-4 py-4 sm:py-6 backdrop-blur-sm bg-slate-950/30 border-t border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <TarjetaIcono
            icono="🛡️"
            titulo="Seguridad"
            subtitulo="en cada acceso"
            bordeColor="hover:border-cyan-500/40"
          />
          <TarjetaIcono
            icono="👥"
            titulo="Compromiso"
            subtitulo="con la educación"
            bordeColor="hover:border-blue-500/40"
          />
          <TarjetaIcono
            icono="📊"
            titulo="Tecnología"
            subtitulo="para tu futuro"
            bordeColor="hover:border-amber-500/40"
          />
          <TarjetaIcono
            icono="💙"
            titulo="Una gran familia"
            subtitulo="Santa Rita de Cassia"
            bordeColor="hover:border-red-500/40"
          />
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] sm:text-xs font-black tracking-[0.3em] text-slate-400/80 uppercase">
            &ldquo;DISCIPLINA HOY, GRANDES LOGROS MAÑANA&rdquo;
          </p>
          <div className="mt-1 h-0.5 w-16 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
        </div>
      </footer>

      {/* ESTILOS CSS 3D Y ANIMACIONES FLUIDAS A 60 FPS */}
      <style jsx>{`
        /* Rotación 3D en el Eje Y del escudo (duración 6 segundos) */
        .escudo-3d-wrapper {
          transform-style: preserve-3d;
          animation: entradaEscudo 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .escudo-3d-rotador {
          transform-style: preserve-3d;
          animation: rotarYCompleto 6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes entradaEscudo {
          0% {
            opacity: 0;
            transform: scale(0.65) translateY(30px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes rotarYCompleto {
          0% {
            transform: rotateY(0deg);
          }
          15% {
            transform: rotateY(0deg);
          }
          65% {
            transform: rotateY(360deg);
          }
          100% {
            transform: rotateY(360deg);
          }
        }

        /* Destello especular metálico sobre el escudo */
        .brillo-especular {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(255, 255, 255, 0.35) 50%,
            transparent 80%
          );
          mix-blend-mode: overlay;
          pointer-events: none;
          animation: brilloBarrido 3s ease-in-out infinite 1s;
        }

        @keyframes brilloBarrido {
          0% {
            transform: translateX(-150%);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          60% {
            transform: translateX(150%);
            opacity: 0;
          }
          100% {
            transform: translateX(150%);
            opacity: 0;
          }
        }

        /* Anillos holográficos que orbitan alrededor del escudo */
        .anillo-holografico-azul {
          position: absolute;
          width: 320px;
          height: 120px;
          border-radius: 50%;
          border: 2px solid rgba(6, 182, 212, 0.7);
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.5), inset 0 0 15px rgba(6, 182, 212, 0.3);
          transform: rotateX(72deg) rotateY(-12deg);
          pointer-events: none;
          animation: orbitarAzul 5s linear infinite;
        }

        .anillo-holografico-dorado {
          position: absolute;
          width: 330px;
          height: 130px;
          border-radius: 50%;
          border: 1.5px solid rgba(245, 158, 11, 0.65);
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.45);
          transform: rotateX(70deg) rotateY(18deg);
          pointer-events: none;
          animation: orbitarDorado 7s linear infinite reverse;
        }

        @keyframes orbitarAzul {
          0% {
            transform: rotateX(72deg) rotateZ(0deg);
          }
          100% {
            transform: rotateX(72deg) rotateZ(360deg);
          }
        }

        @keyframes orbitarDorado {
          0% {
            transform: rotateX(70deg) rotateZ(0deg);
          }
          100% {
            transform: rotateX(70deg) rotateZ(360deg);
          }
        }

        /* Partículas flotantes */
        .particula {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, #38bdf8 0%, rgba(56, 189, 248, 0) 70%);
          pointer-events: none;
          filter: blur(1px);
        }
        .p1 {
          width: 6px;
          height: 6px;
          left: 20%;
          bottom: 25%;
          animation: flotar 4s ease-in-out infinite;
        }
        .p2 {
          width: 8px;
          height: 8px;
          left: 45%;
          bottom: 35%;
          animation: flotar 5s ease-in-out infinite 1s;
        }
        .p3 {
          width: 5px;
          height: 5px;
          right: 25%;
          bottom: 20%;
          animation: flotar 4.5s ease-in-out infinite 2s;
        }
        .p4 {
          width: 7px;
          height: 7px;
          right: 40%;
          bottom: 30%;
          animation: flotar 6s ease-in-out infinite 0.5s;
        }
        .p5 {
          width: 4px;
          height: 4px;
          left: 32%;
          bottom: 15%;
          animation: flotar 3.5s ease-in-out infinite 1.5s;
        }
        .p6 {
          width: 6px;
          height: 6px;
          right: 18%;
          bottom: 40%;
          animation: flotar 5.5s ease-in-out infinite 2.5s;
        }

        @keyframes flotar {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-50px) scale(1.2);
            opacity: 0.9;
          }
          100% {
            transform: translateY(-100px) scale(0.6);
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
}: {
  icono: string;
  titulo: string;
  subtitulo: string;
  bordeColor: string;
}) {
  return (
    <div
      className={`group flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-[1.03] ${bordeColor}`}
    >
      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/20 flex items-center justify-center text-lg sm:text-xl shadow-inner border border-white/10 group-hover:border-cyan-400/40 transition">
        {icono}
      </div>
      <p className="mt-2 text-xs sm:text-sm font-black text-white text-center leading-tight">
        {titulo}
      </p>
      <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 text-center leading-tight mt-0.5">
        {subtitulo}
      </p>
    </div>
  );
}
