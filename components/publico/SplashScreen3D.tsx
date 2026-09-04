"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface SplashScreen3DProps {
  onComplete?: () => void;
  redireccionarA?: string;
  duracionSegundos?: number;
}

export function SplashScreen3D({
  onComplete,
  redireccionarA,
  duracionSegundos = 6.0,
}: SplashScreen3DProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de tiempo (0s a 6s exactos)
  const [tiempo, setTiempo] = useState(0);
  const [saliendo, setSaliendo] = useState(false);

  // Inclinación 3D interactiva (Parallax con mouse o touch)
  const [rotacion3D, setRotacion3D] = useState({ rotX: 0, rotY: 0 });

  // 1. Temporizador de 6.0 segundos exactos con requestAnimationFrame
  useEffect(() => {
    const inicio = performance.now();
    const duracionMs = duracionSegundos * 1000;
    let animFrame: number;

    const tick = (ahora: number) => {
      const transcurrido = ahora - inicio;
      const seg = Math.min(transcurrido / 1000, duracionSegundos);
      setTiempo(seg);

      if (transcurrido < duracionMs) {
        animFrame = requestAnimationFrame(tick);
      } else {
        finalizarSplash();
      }
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [duracionSegundos]);

  function finalizarSplash() {
    setSaliendo(true);
    setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
      if (redireccionarA) {
        router.replace(redireccionarA);
      }
    }, 600);
  }

  // 2. Parallax suave al mover el cursor o dedo
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const x = (clientX - left) / width - 0.5;
    const y = (clientY - top) / height - 0.5;
    setRotacion3D({
      rotX: -y * 12,
      rotY: x * 14,
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const { width, height } = e.currentTarget.getBoundingClientRect();
      const x = touch.clientX / width - 0.5;
      const y = touch.clientY / height - 0.5;
      setRotacion3D({
        rotX: -y * 10,
        rotY: x * 10,
      });
    }
  };

  // 3. Canvas de partículas de polvo dorado y destellos espaciales a 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const numParticulas = Math.min(width > 768 ? 65 : 35, 75);
    const particulas: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radio: number;
      color: string;
      alfa: number;
    }> = [];

    const colores = ["#D4AF37", "#F59E0B", "#FBBF24", "#EF4444", "#FFFFFF"];

    for (let i = 0; i < numParticulas; i++) {
      particulas.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6 - 0.2, // ligera flotación ascendente
        radio: Math.random() * 1.8 + 0.8,
        color: colores[Math.floor(Math.random() * colores.length)],
        alfa: Math.random() * 0.7 + 0.3,
      });
    }

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particulas) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alfa;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  const progresoPorcentaje = Math.min(Math.round((tiempo / duracionSegundos) * 100), 100);

  return (
    <div
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      className={`fixed inset-0 z-[9999] w-screen h-[100dvh] max-h-[100dvh] max-w-[100dvw] flex flex-col justify-between bg-[#04060b] overflow-hidden font-sans select-none transition-all duration-700 p-2 sm:p-5 lg:p-6 ${
        saliendo ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      {/* 1. Canvas de Partículas Doradas en Fondo */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none opacity-60"
      />

      {/* 2. FONDOS LATERALES ARTÍSTICOS CON FUSION CINEMATOGRÁFICA */}
      {/* Lado Izquierdo: Santa Rita de Casia con manos en oración */}
      <div className="absolute top-0 left-0 w-[38vw] max-w-[460px] h-full pointer-events-none z-[1] opacity-35 sm:opacity-45 mix-blend-screen overflow-hidden">
        <div className="relative w-full h-full">
          <Image
            src="/img/santa-rita-portrait.jpg"
            alt="Santa Rita de Casia"
            fill
            className="object-cover object-top filter grayscale contrast-125 brightness-90 mask-radial"
            priority
          />
          {/* Degeneración de gradiente a la derecha y abajo para integrarse perfectamente */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#04060b]/40 to-[#04060b]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#04060b] via-transparent to-[#04060b]/70" />
        </div>
      </div>

      {/* Lado Derecho: Fachada Real del Colegio Santa Rita de Cassia */}
      <div className="absolute top-0 right-0 w-[42vw] max-w-[540px] h-full pointer-events-none z-[1] opacity-30 sm:opacity-40 mix-blend-luminosity overflow-hidden">
        <div className="relative w-full h-full">
          <Image
            src="/img/colegio-santa-rita.jpg"
            alt="I.E.P. Santa Rita de Cassia"
            fill
            className="object-cover object-center filter contrast-115 brightness-95"
            priority
          />
          {/* Degeneración de gradiente a la izquierda y abajo para integrarse con la oscuridad */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#04060b]/40 to-[#04060b]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#04060b] via-transparent to-[#04060b]/70" />
        </div>
      </div>

      {/* Iluminación Volumétrica Cálida Central (Resplandor Granate y Dorado) */}
      <div className="absolute inset-0 pointer-events-none z-[2] bg-[radial-gradient(ellipse_at_center,rgba(185,28,28,0.28)_0%,rgba(139,0,0,0.18)_35%,rgba(4,6,11,0.85)_70%,rgba(4,6,11,1)_100%)]" />

      {/* Halo de luz central dorada detrás del podio */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,620px)] h-[min(90vw,620px)] rounded-full bg-gradient-to-tr from-amber-500/25 via-red-600/20 to-yellow-500/25 blur-[100px] pointer-events-none z-[2]" />

      {/* ======================================================== */}
      {/* 3. BARRA SUPERIOR: LEMA INSTITUCIONAL & BOTÓN OMITIR INTRO */}
      {/* ======================================================== */}
      <div className="relative z-50 w-full max-w-7xl mx-auto flex items-center justify-between pt-1 px-2 sm:px-4 shrink-0">
        {/* Frase poética superior izquierda (tal como en la imagen) */}
        <div className="hidden md:flex flex-col text-left">
          <span className="font-serif italic text-amber-200 text-xs lg:text-sm tracking-wide drop-shadow-md">
            Más que un colegio,
          </span>
          <span className="font-serif italic text-amber-300 text-xs lg:text-sm -mt-0.5 flex items-center gap-1">
            una gran familia <span className="text-red-500 text-xs">♡</span>
          </span>
          <div className="w-16 h-0.5 bg-gradient-to-r from-red-600 to-transparent rounded-full mt-0.5" />
        </div>

        {/* Lema Central: VIRTUD • CIENCIA • LIDERAZGO */}
        <div className="mx-auto flex flex-col items-center">
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs md:text-sm font-semibold tracking-[0.25em] sm:tracking-[0.35em] text-amber-200 uppercase drop-shadow-[0_2px_10px_rgba(245,158,11,0.6)]">
            <span>VIRTUD</span>
            <span className="text-amber-500 text-[9px] sm:text-xs">•</span>
            <span>CIENCIA</span>
            <span className="text-amber-500 text-[9px] sm:text-xs">•</span>
            <span>LIDERAZGO</span>
          </div>
          <div className="w-36 sm:w-56 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent mt-1" />
        </div>

        {/* Botón OMITIR INTRO (Arriba a la derecha) */}
        <button
          type="button"
          onClick={finalizarSplash}
          className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-200 hover:text-white bg-slate-950/80 hover:bg-amber-950/60 border border-amber-400/60 hover:border-amber-300 px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-full backdrop-blur-md transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer shrink-0"
        >
          <span>OMITIR INTRO</span>
          <span className="text-amber-400">→</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 4. BLOQUE CENTRAL DE TÍTULO (Exacto al diseño)           */}
      {/* ======================================================== */}
      <div className="relative z-20 text-center flex flex-col items-center mt-1 sm:mt-2 shrink-0">
        {/* ¡BIENVENIDO! */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-black tracking-[0.06em] text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-yellow-500 drop-shadow-[0_0_35px_rgba(245,158,11,0.9)] leading-none uppercase">
          ¡BIENVENIDO!
        </h1>

        {/* PORTAL WEB DE ASISTENCIA */}
        <h2 className="text-sm sm:text-2xl md:text-3xl font-black tracking-wider text-white uppercase mt-1 sm:mt-2 drop-shadow-md">
          PORTAL WEB DE ASISTENCIA
        </h2>

        {/* SANTA RITA DE CASSIA con alas doradas */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mt-0.5 sm:mt-1">
          <div className="w-8 sm:w-16 h-[1.5px] bg-gradient-to-r from-transparent to-amber-400" />
          <p className="text-xs sm:text-lg md:text-xl font-bold tracking-widest text-amber-300 uppercase">
            SANTA RITA DE CASSIA
          </p>
          <div className="w-8 sm:w-16 h-[1.5px] bg-gradient-to-l from-transparent to-amber-400" />
        </div>

        {/* 📍 CAÑETE - PERÚ */}
        <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-amber-200/90 mt-0.5 tracking-wider uppercase">
          <span className="text-amber-400">📍</span>
          <span>CAÑETE - PERÚ</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. ESCENARIO CENTRAL: PODIO 3D + ESCUDO + 6 MÓDULOS     */}
      {/* ======================================================== */}
      <div className="relative z-20 flex-1 w-full max-w-6xl mx-auto flex items-center justify-between px-2 sm:px-6 my-auto overflow-visible">
        
        {/* ---------------------------------------------------- */}
        {/* COLUMNA IZQUIERDA: 3 MÓDULOS CIRCULARES CON LUZ ORO  */}
        {/* 1. Marcación QR  2. Reconocimiento Facial  3. DNI    */}
        {/* ---------------------------------------------------- */}
        <div className="flex flex-col items-center justify-center gap-3 sm:gap-5 md:gap-6 z-30 shrink-0">
          {/* 1. Marcación por QR */}
          <div className="flex flex-col items-center text-center group cursor-default transition-transform hover:scale-105">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-slate-950/90 border-2 border-amber-400/80 p-2.5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] transition-all">
              <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />
              {/* Icono QR */}
              <svg className="w-full h-full text-amber-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-5 0h2v3h-2v-3zm2 3h3v2h-3v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm-2-2h2v2h-2v-2zm5 2h2v2h-2v-2z" />
              </svg>
            </div>
            <div className="mt-1.5 leading-tight">
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                MARCACIÓN
              </span>
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                POR QR
              </span>
            </div>
          </div>

          {/* 2. Reconocimiento Facial */}
          <div className="flex flex-col items-center text-center group cursor-default transition-transform hover:scale-105">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-slate-950/90 border-2 border-amber-400/80 p-2.5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] transition-all">
              <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />
              {/* Icono Reconocimiento Facial */}
              <svg className="w-full h-full text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <circle cx="9" cy="9" r="1" fill="currentColor" />
                <circle cx="15" cy="9" r="1" fill="currentColor" />
                <path d="M10 15c.5.5 1.5 1 2 1s1.5-.5 2-1" />
                <line x1="12" y1="11" x2="12" y2="13" />
              </svg>
            </div>
            <div className="mt-1.5 leading-tight">
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                RECONOCIMIENTO
              </span>
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                FACIAL
              </span>
            </div>
          </div>

          {/* 3. DNI Estudiante */}
          <div className="flex flex-col items-center text-center group cursor-default transition-transform hover:scale-105">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-slate-950/90 border-2 border-amber-400/80 p-2.5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] transition-all">
              <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />
              {/* Icono Carnet / DNI */}
              <svg className="w-full h-full text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <circle cx="8" cy="10" r="2" />
                <line x1="6" y1="16" x2="10" y2="16" />
                <line x1="14" y1="9" x2="18" y2="9" />
                <line x1="14" y1="13" x2="18" y2="13" />
              </svg>
            </div>
            <div className="mt-1.5 leading-tight">
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                DNI
              </span>
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                ESTUDIANTE
              </span>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* NÚCLEO CENTRAL: PODIO 3D + ESCUDO SOBRE EL PEDESTAL */}
        {/* ---------------------------------------------------- */}
        <div
          className="relative flex-1 flex flex-col items-center justify-center [perspective:1400px] my-auto"
          style={{
            transform: `rotateX(${rotacion3D.rotX}deg) rotateY(${rotacion3D.rotY}deg)`,
            transition: "transform 0.15s ease-out",
          }}
        >
          {/* Anillos de Energía Orbital alrededor del Escudo */}
          <div className="absolute w-[min(70vw,380px)] h-[min(70vw,380px)] rounded-full border-2 border-amber-400/40 animate-[spin_20s_linear_infinite] pointer-events-none [transform:rotateX(68deg)]" />
          <div className="absolute w-[min(75vw,440px)] h-[min(75vw,440px)] rounded-full border border-red-500/50 animate-[spin_14s_linear_infinite_reverse] pointer-events-none [transform:rotateX(72deg)]" />
          <div className="absolute w-[min(82vw,500px)] h-[min(82vw,500px)] rounded-full border border-dashed border-amber-300/30 animate-pulse pointer-events-none [transform:rotateX(75deg)]" />

          {/* ESCUDO OFICIAL CON MARCO 3D METÁLICO DORADO */}
          <div className="relative z-30 w-[clamp(130px,28vmin,230px)] h-[clamp(150px,32vmin,265px)] flex items-center justify-center transition-transform duration-700 ease-out transform hover:scale-105">
            {/* Resplandor áurico dorado detrás del escudo */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-red-600/40 via-amber-400/40 to-yellow-200/30 blur-2xl pointer-events-none" />

            {/* Contenedor del Escudo con Bisel Dorado Metálico */}
            <div
              className="relative w-full h-full rounded-[2rem] p-2.5 sm:p-3.5 bg-gradient-to-b from-[#fef08a] via-[#ca8a04] to-[#713f12] shadow-[0_0_50px_rgba(245,158,11,0.8),0_20px_40px_rgba(0,0,0,0.9)] flex items-center justify-center border-2 border-amber-300"
              style={{
                transformStyle: "preserve-3d",
                boxShadow: "0 0 35px rgba(245, 158, 11, 0.7), 0 25px 50px rgba(0, 0, 0, 0.95), inset 0 2px 4px rgba(255, 255, 255, 0.9), inset 0 -2px 6px rgba(0, 0, 0, 0.8)",
              }}
            >
              {/* Borde biselado interior */}
              <div className="relative w-full h-full rounded-[1.6rem] bg-gradient-to-b from-white via-slate-100 to-amber-50 p-2 sm:p-3 flex items-center justify-center shadow-inner overflow-hidden">
                {/* Destello de barrido de luz metálica */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-amber-300/60 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none" />

                {/* Imagen del Escudo Oficial */}
                <Image
                  src="/img/logo-santa-rita.png"
                  alt="Escudo Oficial Santa Rita de Cassia"
                  width={220}
                  height={240}
                  className="object-contain w-full h-full filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
                  priority
                />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* PODIO 3D DORADO / PEDESTAL DE LUZ (Tal como en la foto)*/}
          {/* ---------------------------------------------------- */}
          <div className="relative -mt-6 sm:-mt-8 z-20 flex flex-col items-center pointer-events-none w-full max-w-[340px] sm:max-w-[420px]">
            {/* Nivel Superior del Podio (Plataforma circular dorada iluminada) */}
            <div
              className="w-48 sm:w-64 md:w-80 h-10 sm:h-12 rounded-[50%] bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#854d0e] border-2 border-amber-200 shadow-[0_0_40px_rgba(245,158,11,0.9),inset_0_2px_4px_rgba(255,255,255,0.9)] flex items-center justify-center relative"
            >
              <div className="w-[92%] h-[82%] rounded-[50%] bg-gradient-to-b from-[#78350f] via-[#1e293b] to-[#0f172a] border border-amber-400/80 shadow-inner flex items-center justify-center">
                <div className="w-[80%] h-[70%] rounded-[50%] bg-gradient-to-t from-red-600/60 via-amber-500/40 to-transparent blur-[2px]" />
              </div>
            </div>

            {/* Base Cilíndrica Intermedia con Brillo y Reflexión */}
            <div className="w-56 sm:w-72 md:w-96 h-5 sm:h-7 -mt-4 rounded-[50%] bg-gradient-to-b from-[#ca8a04] via-[#713f12] to-[#1c1917] border border-amber-500/70 shadow-[0_10px_25px_rgba(0,0,0,0.9)]" />

            {/* Nivel Inferior con Anillo de Luz Láser Roja y Oro en el Suelo */}
            <div className="w-64 sm:w-80 md:w-[28rem] h-8 sm:h-10 -mt-3 rounded-[50%] bg-gradient-to-b from-amber-500/30 via-red-600/30 to-transparent border-t-2 border-amber-400 shadow-[0_0_50px_rgba(239,68,68,0.7)] flex items-center justify-center">
              <div className="w-[95%] h-[80%] rounded-[50%] border border-red-500/60 animate-pulse" />
            </div>

            {/* Círculos de luz radial en el suelo oscuro reflectante */}
            <div className="absolute -bottom-6 w-72 sm:w-96 md:w-[32rem] h-12 rounded-[50%] bg-gradient-to-t from-transparent via-red-600/20 to-amber-500/30 blur-md pointer-events-none" />
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* COLUMNA DERECHA: 3 MÓDULOS CIRCULARES CON LUZ ORO    */}
        {/* 1. Foto Evidencia  2. Estadísticas  3. Familias      */}
        {/* ---------------------------------------------------- */}
        <div className="flex flex-col items-center justify-center gap-3 sm:gap-5 md:gap-6 z-30 shrink-0">
          {/* 1. Foto Evidencia */}
          <div className="flex flex-col items-center text-center group cursor-default transition-transform hover:scale-105">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-slate-950/90 border-2 border-amber-400/80 p-2.5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] transition-all">
              <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />
              {/* Icono Cámara */}
              <svg className="w-full h-full text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="mt-1.5 leading-tight">
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                FOTO
              </span>
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                EVIDENCIA
              </span>
            </div>
          </div>

          {/* 2. Estadísticas en Tiempo Real */}
          <div className="flex flex-col items-center text-center group cursor-default transition-transform hover:scale-105">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-slate-950/90 border-2 border-amber-400/80 p-2.5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] transition-all">
              <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />
              {/* Icono Gráficos / Barras */}
              <svg className="w-full h-full text-amber-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 9.2h3V19H5zM10.6 5h2.8v14.2h-2.8zm5.6 8h2.8v6.2h-2.8z" />
                <path d="M4 19h16v2H4z" />
              </svg>
            </div>
            <div className="mt-1.5 leading-tight">
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                ESTADÍSTICAS
              </span>
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                EN TIEMPO REAL
              </span>
            </div>
          </div>

          {/* 3. Conexión con Familias */}
          <div className="flex flex-col items-center text-center group cursor-default transition-transform hover:scale-105">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-slate-950/90 border-2 border-amber-400/80 p-2.5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.7)] transition-all">
              <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />
              {/* Icono Familia / Grupo */}
              <svg className="w-full h-full text-amber-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="mt-1.5 leading-tight">
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                CONEXIÓN
              </span>
              <span className="block text-[8px] sm:text-[10px] md:text-xs font-black text-amber-100 uppercase tracking-wider">
                CON FAMILIAS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Frase poética lateral derecha (exacta a la imagen) */}
      <div className="hidden lg:block absolute right-6 bottom-24 z-20 text-right pointer-events-none">
        <p className="font-serif italic text-amber-200 text-sm lg:text-base drop-shadow-md">
          &ldquo;Con educación
        </p>
        <p className="font-serif italic text-amber-200 text-sm lg:text-base drop-shadow-md -mt-1">
          construimos
        </p>
        <p className="font-serif italic text-amber-200 text-sm lg:text-base drop-shadow-md -mt-1">
          un mejor mañana&rdquo;
        </p>
      </div>

      {/* ======================================================== */}
      {/* 6. PIE DE PÁGINA: BARRA DE CARGA INTELIGENTE & METADATOS */}
      {/* ======================================================== */}
      <div className="relative z-30 w-full max-w-6xl mx-auto flex flex-col items-center pb-2 px-2 shrink-0">
        
        {/* Título de la Barra: CARGANDO SISTEMA INTELIGENTE... */}
        <p className="text-[10px] sm:text-xs md:text-sm font-black tracking-[0.25em] text-amber-200 uppercase mb-1 sm:mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
          CARGANDO SISTEMA INTELIGENTE...
        </p>

        {/* Barra de Progreso y Porcentaje */}
        <div className="w-full max-w-xl flex items-center gap-3">
          {/* Contenedor de Barra con Borde Dorado Metálico */}
          <div className="flex-1 h-3 sm:h-3.5 bg-slate-950/90 rounded-full overflow-hidden border border-amber-400/80 p-0.5 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <div
              className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-300 rounded-full transition-all duration-75 shadow-[0_0_18px_rgba(245,158,11,0.95)] relative"
              style={{ width: `${progresoPorcentaje}%` }}
            >
              {/* Punto de brillo en la punta de la barra */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/80 rounded-full blur-[1px]" />
            </div>
          </div>

          {/* Porcentaje numérico (ej. 68% tal como en la foto) */}
          <span className="text-sm sm:text-base md:text-lg font-black text-amber-300 font-mono tracking-tight tabular-nums drop-shadow-md">
            {progresoPorcentaje}%
          </span>
        </div>

        {/* Fila Inferior con badges decorativos (tal como en la imagen) */}
        <div className="w-full flex items-center justify-between mt-2 pt-1 border-t border-amber-500/20 text-[9px] sm:text-xs text-amber-300/80 font-medium">
          {/* Badge Izquierdo: 🎓 "Educación que deja huella" */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-amber-400/30 text-amber-200">
            <span>🎓</span>
            <span className="font-serif italic">&ldquo;Educación que deja huella&rdquo;</span>
          </div>

          {/* Badge Derecho: 📍 SAN VICENTE DE CAÑETE · PERÚ */}
          <div className="inline-flex items-center gap-1.5 text-amber-300/90 font-mono text-[9px] sm:text-[10px] tracking-wider uppercase">
            <span>📍</span>
            <span>SAN VICENTE DE CAÑETE · PERÚ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
