"use client";

import React from "react";

export function SeccionNosotros() {
  const pilares = [
    {
      icono: "🌹",
      titulo: "Virtud, Fe y Liderazgo",
      descripcion:
        "Inspiradas en el testimonio de Santa Rita de Cassia, formamos ciudadanas íntegras, solidarias y comprometidas con el desarrollo ético de Cañete y del Perú.",
      color: "from-red-900/10 to-red-950/20 text-red-950 border-red-200/80",
    },
    {
      icono: "🛡️",
      titulo: "Seguridad y Control en Portería",
      descripcion:
        "Sistema tecnológico moderno en los accesos escolares: captura fotográfica en cada marcación, verificación biométrica y registro de horario exacto.",
      color: "from-amber-900/10 to-amber-950/20 text-amber-950 border-amber-200/80",
    },
    {
      icono: "📱",
      titulo: "Conexión Inmediata con la Familia",
      descripcion:
        "Las familias cuentan con un portal web privado y canales directos de notificación para conocer al instante el ingreso seguro de sus hijas al colegio.",
      color: "from-slate-900/10 to-slate-950/20 text-slate-950 border-slate-200",
    },
  ];

  return (
    <section id="nosotros" className="py-10 sm:py-16 lg:py-20 bg-slate-50 border-y border-slate-200/80 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-red-800 bg-red-100/80 px-3 py-1 rounded-full border border-red-200">
            Nuestra Identidad Institucional
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mt-3 tracking-tight">
            I.E.P. Santa Rita de Cassia
          </h2>
          <p className="text-slate-600 mt-2 sm:mt-3 text-xs sm:text-sm lg:text-base leading-relaxed">
            Una institución emblemática de la provincia de Cañete dedicada a la formación humanista, científica y valórica de nuestras estudiantes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {pilares.map((pilar, idx) => (
            <div
              key={idx}
              className={`p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-b ${pilar.color} border shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between`}
            >
              <div>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 bg-white w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm">
                  {pilar.icono}
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5">
                  {pilar.titulo}
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  {pilar.descripcion}
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-200/60 flex items-center text-[11px] sm:text-xs font-bold text-slate-700">
                <span>Excelencia Educativa</span>
                <span className="ml-auto text-amber-600">★ ★ ★ ★ ★</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
