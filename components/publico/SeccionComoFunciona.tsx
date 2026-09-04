"use client";

import React from "react";

export function SeccionComoFunciona() {
  const pasos = [
    {
      numero: "01",
      icono: "📱",
      titulo: "Registro QR Veloz",
      subtitulo: "Ingreso en portería en menos de un segundo",
      descripcion:
        "Cada estudiante presenta su carné institucional con código QR individual al ingresar a la institución.",
      badge: "Portería Escolar",
      colorBadge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    {
      numero: "02",
      icono: "🤖",
      titulo: "Validación Inteligente",
      subtitulo: "Algoritmo de control de turnos y tolerancia",
      descripcion:
        "El sistema valida en tiempo real el turno asignado (Mañana, Tarde o Noche) y determina el estado: Puntual o Tardanza.",
      badge: "Automatización",
      colorBadge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    },
    {
      numero: "03",
      icono: "📷",
      titulo: "Evidencia Fotográfica",
      subtitulo: "Seguridad y respaldo visual en la nube",
      descripcion:
        "La cámara de portería captura una foto de evidencia al registrar la entrada, alojada de forma segura en Vercel Blob.",
      badge: "Vercel Blob ☁",
      colorBadge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    },
    {
      numero: "04",
      icono: "👨‍👩‍👧",
      titulo: "Consulta Familiar",
      subtitulo: "Acceso inmediato para padres y apoderados",
      descripcion:
        "Los padres ingresan al Portal Familiar con DNI y su Código Familiar único para verificar asistencia y fotos en vivo.",
      badge: "Portal Padres",
      colorBadge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
  ];

  return (
    <section id="como-funciona" className="py-10 sm:py-16 lg:py-20 bg-slate-900/60 border-y border-slate-800/80 relative overflow-hidden">
      {/* Luces sutiles de fondo */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Cabecera de la sección */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/50 text-red-200 text-[10px] sm:text-xs font-black tracking-widest uppercase">
            <span>⚙️</span>
            <span>Innovación al Servicio Educativo</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
            ¿Cómo Funciona el Sistema?
          </h2>
          <p className="text-xs sm:text-sm lg:text-base text-slate-300">
            Un flujo digital transparente de 4 pasos diseñado para la seguridad de nuestras alumnas y la tranquilidad de las familias santarritenses.
          </p>
        </div>

        {/* Rejilla de los 4 Pasos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {pasos.map((paso, index) => (
            <div
              key={paso.numero}
              className="group relative rounded-2xl sm:rounded-3xl bg-slate-950/80 border border-slate-800 p-5 sm:p-6 flex flex-col justify-between hover:border-amber-400/50 hover:bg-slate-900 transition-all duration-300 shadow-xl hover:-translate-y-1"
            >
              <div>
                {/* Indicador de Número y Badge */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400/40 group-hover:text-amber-400 transition-colors font-mono">
                    {paso.numero}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border ${paso.colorBadge}`}
                  >
                    {paso.badge}
                  </span>
                </div>

                {/* Ícono */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-xl sm:text-2xl mb-3 sm:mb-4 group-hover:scale-110 group-hover:border-amber-400/50 transition-all shadow-inner">
                  {paso.icono}
                </div>

                {/* Título y Subtítulo */}
                <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                  {paso.titulo}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-1 mb-2 sm:mb-3">
                  {paso.subtitulo}
                </p>

                {/* Descripción */}
                <p className="text-xs text-slate-300 leading-relaxed">
                  {paso.descripcion}
                </p>
              </div>

              {/* Indicador inferior */}
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-400">
                <span className="group-hover:text-amber-300 transition-colors">
                  Paso {index + 1} de 4
                </span>
                <span className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  ✓ Verificado
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
