"use client";

import React from "react";

interface CanalesConfiguracionProps {
  canalTelegramActivo: boolean;
  canalWhatsAppActivo: boolean;
  canalPortalWebActivo: boolean;
  onChange: (
    campo: "canalTelegramActivo" | "canalWhatsAppActivo" | "canalPortalWebActivo",
    valor: boolean
  ) => void;
}

export function CanalesConfiguracion({
  canalTelegramActivo,
  canalWhatsAppActivo,
  canalPortalWebActivo,
  onChange,
}: CanalesConfiguracionProps) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 text-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
              <span>📡</span> Canales de Comunicación y Notificación
            </h2>
            <p className="text-slate-300 mt-2 text-sm sm:text-base">
              Active o desactive los canales de alerta inmediata y el portal web familiar sin alterar la lógica central de asistencia.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-400/30 self-start sm:self-auto">
            ⚡ TIEMPO REAL
          </span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Telegram Bot */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/70 transition hover:bg-slate-100/70">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">✈️</span>
              <h3 className="font-extrabold text-slate-900 text-lg">Notificaciones Telegram Bot</h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase ${
                  canalTelegramActivo
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-slate-200 text-slate-600 border border-slate-300"
                }`}
              >
                {canalTelegramActivo ? "Activo" : "Desactivado"}
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Envío instantáneo de alertas de texto de entrada y salida a los padres de familia con Telegram Chat ID registrado. Las evidencias fotográficas quedan resguardadas en Vercel Blob para consulta en el Portal Web de Padres.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={canalTelegramActivo}
              onChange={(e) => onChange("canalTelegramActivo", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
          </label>
        </div>

        {/* WhatsApp Cloud API */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/70 transition hover:bg-slate-100/70">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">💬</span>
              <h3 className="font-extrabold text-slate-900 text-lg">WhatsApp Cloud API</h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase ${
                  canalWhatsAppActivo
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                {canalWhatsAppActivo ? "Activo" : "En pausa / Desactivado"}
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Envío de alertas de asistencia vía WhatsApp. Mantener desactivado si no se cuenta con plantillas pre-aprobadas por Meta para envíos fuera de la ventana de 24 horas.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={canalWhatsAppActivo}
              onChange={(e) => onChange("canalWhatsAppActivo", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
          </label>
        </div>

        {/* Portal Web */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/70 transition hover:bg-slate-100/70">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌐</span>
              <h3 className="font-extrabold text-slate-900 text-lg">Portal Web de Familias (Código Familiar)</h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase ${
                  canalPortalWebActivo
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-slate-200 text-slate-600 border border-slate-300"
                }`}
              >
                {canalPortalWebActivo ? "Habilitado" : "Suspendido"}
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Permite a los apoderados consultar en tiempo real el historial de asistencia, métricas analíticas y fotografías de evidencia ingresando con su DNI y Código Familiar.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={canalPortalWebActivo}
              onChange={(e) => onChange("canalPortalWebActivo", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
          </label>
        </div>
      </div>
    </section>
  );
}
