"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface HeaderPublicoProps {
  nombreColegio?: string;
  logoUrl?: string;
}

export function HeaderPublico({
  nombreColegio = "I.E.P. Santa Rita de Cassia",
  logoUrl = "/img/logo-santa-rita.png",
}: HeaderPublicoProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-red-900/40 text-white shadow-xl transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo e Identidad Institucional */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3.5 group min-w-0 pr-2">
            <div className="relative w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white p-1 shadow-md ring-2 ring-amber-400/40 group-hover:ring-amber-400 transition shrink-0">
              <Image
                src={logoUrl}
                alt="Escudo Santa Rita de Cassia"
                width={48}
                height={48}
                className="object-contain w-full h-full"
                priority
              />
            </div>
            <div className="min-w-0 truncate">
              <span className="block font-black text-sm sm:text-base lg:text-lg xl:text-xl tracking-tight text-white group-hover:text-amber-300 transition truncate">
                {nombreColegio}
              </span>
              <span className="block text-[9px] sm:text-[10px] xl:text-[11px] font-bold tracking-widest text-amber-400 uppercase truncate">
                San Vicente de Cañete · Perú
              </span>
            </div>
          </Link>

          {/* Menú de Navegación Desktop (Visible >= 1024px) */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-7 text-xs xl:text-sm font-semibold text-slate-300 shrink-0">
            <a href="#inicio" className="hover:text-amber-400 transition py-1">
              Inicio
            </a>
            <a href="#nosotros" className="hover:text-amber-400 transition py-1">
              Nosotros
            </a>
            <a href="#estadisticas" className="hover:text-amber-400 transition py-1">
              Estadísticas
            </a>
            <a href="#comunicados" className="hover:text-amber-400 transition py-1">
              Comunicados
            </a>
            <a href="#contacto" className="hover:text-amber-400 transition py-1">
              Contacto
            </a>
          </nav>

          {/* Botón Destacado: Consultar Asistencia */}
          <div className="hidden sm:flex items-center gap-2 xl:gap-3 shrink-0">
            <Link
              href="/portal-padres"
              className="relative inline-flex items-center justify-center gap-1.5 xl:gap-2 px-3.5 py-2 xl:px-5 xl:py-2.5 rounded-xl xl:rounded-2xl font-black text-xs xl:text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-amber-300/60"
            >
              <span className="text-sm xl:text-base">🔐</span>
              <span className="hidden md:inline">CONSULTAR ASISTENCIA DE MI HIJA</span>
              <span className="md:hidden">PORTAL FAMILIAS</span>
            </Link>
          </div>

          {/* Botón Menú Mobile (< 1024px) */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <Link
              href="/portal-padres"
              className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 sm:hidden shadow-sm"
            >
              <span>🔐</span>
              <span>Portal</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition"
              aria-label="Menú de Navegación"
            >
              <span className="text-xl sm:text-2xl font-bold">{menuAbierto ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Menú Móvil */}
      {menuAbierto && (
        <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-5 py-6 space-y-4 animate-in slide-in-from-top duration-200">
          <nav className="flex flex-col space-y-3 text-base font-semibold text-slate-300">
            <a
              href="#inicio"
              onClick={() => setMenuAbierto(false)}
              className="p-2 rounded-lg hover:bg-slate-900 hover:text-amber-400"
            >
              Inicio
            </a>
            <a
              href="#nosotros"
              onClick={() => setMenuAbierto(false)}
              className="p-2 rounded-lg hover:bg-slate-900 hover:text-amber-400"
            >
              Nosotros
            </a>
            <a
              href="#estadisticas"
              onClick={() => setMenuAbierto(false)}
              className="p-2 rounded-lg hover:bg-slate-900 hover:text-amber-400"
            >
              Estadísticas de Asistencia
            </a>
            <a
              href="#comunicados"
              onClick={() => setMenuAbierto(false)}
              className="p-2 rounded-lg hover:bg-slate-900 hover:text-amber-400"
            >
              Comunicados
            </a>
            <a
              href="#contacto"
              onClick={() => setMenuAbierto(false)}
              className="p-2 rounded-lg hover:bg-slate-900 hover:text-amber-400"
            >
              Contacto
            </a>
          </nav>

          <div className="pt-3 border-t border-slate-800">
            <Link
              href="/portal-padres"
              onClick={() => setMenuAbierto(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 shadow-md"
            >
              <span>🔐</span>
              <span>CONSULTAR ASISTENCIA DE MI HIJA</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
