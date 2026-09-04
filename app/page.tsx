"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HeaderPublico } from "@/components/publico/HeaderPublico";
import { HeroStorytellingAnimation } from "@/components/publico/HeroStorytellingAnimation";
import { SeccionComoFunciona } from "@/components/publico/SeccionComoFunciona";
import { DashboardAsistenciaPublica } from "@/components/publico/DashboardAsistenciaPublica";
import { SeccionNosotros } from "@/components/publico/SeccionNosotros";
import { SeccionComunicados } from "@/components/publico/SeccionComunicados";
import { FooterPublico } from "@/components/publico/FooterPublico";
import { SplashScreen3D } from "@/components/publico/SplashScreen3D";

export default function HomePage() {
  const [mostrarSplash, setMostrarSplash] = useState(true);

  function handleFinalizarSplash() {
    setMostrarSplash(false);
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden flex flex-col bg-slate-100 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* 0. SPLASH SCREEN 3D CINEMATOGRÁFICO DE 6 SEGUNDOS */}
      {mostrarSplash && (
        <SplashScreen3D
          duracionSegundos={6.0}
          onComplete={handleFinalizarSplash}
        />
      )}

      {/* 1. ENCABEZADO INSTITUCIONAL */}
      <HeaderPublico />

      {/* 2. HERO PRINCIPAL: SISTEMA INTELIGENTE DE ASISTENCIA ESCOLAR */}
      <section id="inicio" className="relative bg-slate-950 text-white overflow-hidden py-8 sm:py-12 lg:py-16 border-b border-red-950/40">
        {/* Imagen de fondo del colegio con overlay institucional */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 scale-105 transform transition-transform duration-1000 pointer-events-none"
          style={{ backgroundImage: "url('/img/colegio-santa-rita.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-red-950/70 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-8 items-center">
            {/* Columna Izquierda en Laptop / Principal en Móvil */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-center lg:text-left flex flex-col items-center lg:items-start">
              {/* Badge Institucional */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-400/40 text-amber-300 text-[11px] sm:text-xs font-black tracking-widest uppercase shadow-sm">
                <span>🌹</span>
                <span>Virtud, Ciencia y Liderazgo · San Vicente de Cañete</span>
              </div>

              {/* Titular Principal Responsive con Clamp */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.15] max-w-2xl">
                Sistema Inteligente de Asistencia Escolar
              </h1>

              {/* Subtítulo Responsive */}
              <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
                Tecnología, transparencia y seguridad para el seguimiento diario de nuestras estudiantes.
              </p>

              {/* Botones de Acción Adaptados (Full Width en Móvil) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-1 w-full sm:w-auto">
                <Link
                  href="/portal-padres"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 sm:px-7 sm:py-4 rounded-2xl font-black text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-2 border-amber-200 text-center"
                >
                  <span className="text-lg sm:text-xl">🔐</span>
                  <span>Consultar Asistencia de mi Hija</span>
                </Link>

                <a
                  href="#estadisticas"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 transition shadow-lg text-center"
                >
                  <span>📊</span>
                  <span>Ver Métricas Públicas</span>
                </a>
              </div>

              {/* Ticker de Características y Confianza */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-4 sm:pt-6 border-t border-slate-800/80 text-xs text-slate-300 w-full text-left">
                <div className="flex items-center gap-2">
                  <span className="text-base text-emerald-400 font-bold">✓</span>
                  <span>Registro QR y Biométrico</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base text-amber-400 font-bold">✓</span>
                  <span>Evidencia Vercel Blob</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base text-sky-400 font-bold">✓</span>
                  <span>Acceso familiar seguro</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha en Laptop: Animación 2D Storytelling Educativo */}
            <div className="lg:col-span-5 w-full flex justify-center mt-4 lg:mt-0">
              <HeroStorytellingAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECCIÓN "CÓMO FUNCIONA" (4 PASOS INTERACTIVOS) */}
      <SeccionComoFunciona />

      {/* 4. DASHBOARD PÚBLICO DE ASISTENCIA (CON 3 GRÁFICOS RECHARTS) */}
      <section id="estadisticas" className="py-10 sm:py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full overflow-hidden">
        <DashboardAsistenciaPublica />
      </section>

      {/* 5. SECCIÓN NOSOTROS */}
      <SeccionNosotros />

      {/* 6. SECCIÓN COMUNICADOS */}
      <SeccionComunicados />

      {/* 7. PIE DE PÁGINA INSTITUCIONAL */}
      <FooterPublico />
    </div>
  );
}
