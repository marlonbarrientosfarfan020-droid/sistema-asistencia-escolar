"use client";

import React from "react";
import Link from "next/link";

export function SeccionComunicados() {
  const comunicados = [
    {
      tipo: "HORARIO DE INGRESO",
      titulo: "Horarios y Tolerancia de Entrada Escolar",
      fecha: "Periodo Lectivo 2026",
      contenido:
        "La puerta de ingreso principal se abre a las 07:15 hrs. La hora oficial de formación e ingreso puntual concluye a las 07:45 hrs. Posterior a este horario se registrará como Tardanza en el sistema.",
      icono: "⏰",
      destacado: true,
    },
    {
      tipo: "PORTAL FAMILIAR",
      titulo: "Consultas de Asistencia con Código Familiar",
      fecha: "Acceso Permanente",
      contenido:
        "Cada familia cuenta con una credencial única (SR-2026-XXXX). Con ella y el DNI de su hija pueden verificar desde cualquier dispositivo la puntualidad diaria y fotografías de ingreso.",
      icono: "🔐",
      destacado: false,
    },
    {
      tipo: "EVIDENCIA FOTOGRÁFICA",
      titulo: "Tecnología Biométrica y Registro Seguro",
      fecha: "Seguridad Escolar",
      contenido:
        "Cada vez que una estudiante registra su entrada o salida con su código QR o DNI, el sistema toma una fotografía automática en portería que queda almacenada como respaldo institucional.",
      icono: "📸",
      destacado: false,
    },
  ];

  return (
    <section id="comunicados" className="py-10 sm:py-16 lg:py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              Información de Interés
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mt-2 sm:mt-3 tracking-tight">
              Comunicados Institucionales
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm lg:text-base mt-1">
              Normas de convivencia, horarios de portería y pautas para padres de familia.
            </p>
          </div>

          <Link
            href="/portal-padres"
            className="self-start sm:self-auto px-4 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-2 shrink-0 shadow-sm"
          >
            <span>🔐</span>
            <span>Acceder al Portal de Padres</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {comunicados.map((com, idx) => (
            <div
              key={idx}
              className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition duration-200 flex flex-col justify-between ${
                com.destacado
                  ? "bg-gradient-to-b from-red-50/70 to-white border-red-200 shadow-sm"
                  : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl">{com.icono}</span>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {com.tipo}
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1.5">
                  {com.titulo}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {com.contenido}
                </p>
              </div>

              <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-100 text-[10px] sm:text-[11px] text-slate-400 font-semibold">
                {com.fecha}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
