"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

interface FooterPublicoProps {
  nombreColegio?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  logoUrl?: string;
}

export function FooterPublico({
  nombreColegio = "I.E.P. Santa Rita de Cassia",
  direccion = "San Vicente de Cañete, Lima - Perú",
  telefono = "(01) 581-2244",
  correo = "contacto@santaritadecassia.edu.pe",
  logoUrl = "/img/logo-santa-rita.png",
}: FooterPublicoProps) {
  return (
    <footer id="contacto" className="bg-slate-950 text-white border-t border-red-950/60 pt-10 sm:pt-16 pb-8 sm:pb-12 relative overflow-hidden">
      {/* Glow institucional de fondo */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-48 bg-gradient-to-t from-red-950/20 via-amber-500/5 to-transparent pointer-events-none rounded-t-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-16">
        {/* SECCIÓN DESTACADA: ACCESOS AL SISTEMA (3 TARJETAS MODERNAS) */}
        <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-10 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 border-b border-slate-800/80 pb-4 sm:pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[9px] sm:text-[10px] font-black tracking-widest uppercase mb-1.5 sm:mb-2">
                <span>🛡️</span>
                <span>Plataforma Segura Institucional</span>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                ACCESOS AL SISTEMA
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Seleccione el portal correspondiente según su rol en la comunidad educativa Santa Rita de Cassia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {/* Tarjeta 1: Portal Familias */}
            <Link
              href="/portal-padres"
              className="group relative rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-950 p-5 sm:p-6 border-2 border-amber-400/40 hover:border-amber-400 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition duration-200">
                    👨‍👩‍👧
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-amber-400/30">
                    Familias
                  </span>
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition">
                    Portal Familias
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Consulta asistencia de estudiantes con DNI y Código Familiar.
                  </p>
                </div>
              </div>
              <div className="pt-4 sm:pt-5 mt-3 sm:mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
                <span>Ingresar con DNI + Código</span>
                <span className="group-hover:translate-x-1 transition duration-200">→</span>
              </div>
            </Link>

            {/* Tarjeta 2: Personal / Directivo */}
            <Link
              href="/login"
              className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 p-5 sm:p-6 border border-slate-700 hover:border-slate-500 shadow-lg hover:shadow-slate-700/20 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition duration-200">
                    🔐
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-300 bg-slate-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-slate-700">
                    Gestión
                  </span>
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-black text-white group-hover:text-slate-100 transition">
                    Personal / Directivo
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Administración del sistema, reportes oficiales y control de asistencias.
                  </p>
                </div>
              </div>
              <div className="pt-4 sm:pt-5 mt-3 sm:mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-white">
                <span>Ingresar con Usuario</span>
                <span className="group-hover:translate-x-1 transition duration-200">→</span>
              </div>
            </Link>

            {/* Tarjeta 3: Terminal Portería */}
            <Link
              href="/marcar"
              className="group relative rounded-2xl bg-gradient-to-br from-red-950/40 via-slate-900/70 to-slate-950 p-5 sm:p-6 border border-red-900/50 hover:border-red-600/70 shadow-lg hover:shadow-red-900/20 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition duration-200">
                    🚪
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-red-300 bg-red-950/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-red-800/50">
                    Portería
                  </span>
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-black text-white group-hover:text-red-200 transition">
                    Terminal Portería
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Registro de asistencia mediante QR, DNI y Reconocimiento Facial.
                  </p>
                </div>
              </div>
              <div className="pt-4 sm:pt-5 mt-3 sm:mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-red-300 group-hover:text-red-200">
                <span>Acceso protegido a estación</span>
                <span className="group-hover:translate-x-1 transition duration-200">→</span>
              </div>
            </Link>
          </div>
        </div>

        {/* PIE DE PÁGINA INFORMATIVO E INSTITUCIONAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10 pb-8 sm:pb-10 border-b border-slate-900">
          {/* Columna 1: Identidad */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white p-1 shadow-md ring-2 ring-amber-400/40 shrink-0">
                <Image
                  src={logoUrl}
                  alt="Escudo Santa Rita de Cassia"
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <h3 className="font-black text-lg tracking-tight text-white">
                  {nombreColegio}
                </h3>
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                  Cañete · Lima · Perú
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Formación integral basada en virtudes cristianas, excelencia académica e innovación tecnológica para el seguimiento escolar en tiempo real.
            </p>
          </div>

          {/* Columna 2: Navegación Institucional */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-4">
              Navegación Web
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <a href="#inicio" className="hover:text-white transition">
                  Inicio Institucional
                </a>
              </li>
              <li>
                <a href="#nosotros" className="hover:text-white transition">
                  Nosotros y Filosofía
                </a>
              </li>
              <li>
                <a href="#estadisticas" className="hover:text-white transition">
                  Estadísticas de Asistencia
                </a>
              </li>
              <li>
                <a href="#comunicados" className="hover:text-white transition">
                  Comunicados Oficiales
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-white transition">
                  Ubicación y Canales de Atención
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 3: Horarios de Atención */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-4">
              Horario de Atención
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <span>⏰</span>
                <span><strong>Lunes a Viernes:</strong> 07:00 - 16:30</span>
              </p>
              <p className="flex items-center gap-2">
                <span>📍</span>
                <span><strong>Sede Principal:</strong> San Vicente de Cañete</span>
              </p>
              <p className="flex items-center gap-2 text-amber-300 font-semibold pt-1">
                <span>🌹</span>
                <span>Virtud, Ciencia y Liderazgo</span>
              </p>
            </div>
          </div>

          {/* Columna 4: Contacto */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-4">
              Contacto Institucional
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <p className="flex items-start gap-2">
                <span>📍</span>
                <span>{direccion}</span>
              </p>
              <p className="flex items-center gap-2">
                <span>📞</span>
                <span>{telefono}</span>
              </p>
              <p className="flex items-center gap-2">
                <span>✉️</span>
                <span className="truncate">{correo}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Créditos y Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-2">
          <p>
            © {new Date().getFullYear()} {nombreColegio}. Todos los derechos reservados.
          </p>
          <p className="text-slate-400">
            Sistema Inteligente de Asistencia Escolar · <span className="text-slate-300">San Vicente de Cañete, Perú</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

