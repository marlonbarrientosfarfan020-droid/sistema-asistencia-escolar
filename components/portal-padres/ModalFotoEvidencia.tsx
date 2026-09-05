"use client";

import React from "react";
import Image from "next/image";

export interface AsistenciaEvidencia {
  id: number;
  fecha: string;
  fechaDia?: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  metodo: string;
  estado: string;
  estadoJornada?: string | null;
  estadoSalida?: string | null;
  fotoEntrada: string | null;
  fotoSalida: string | null;
  fotoUrl: string | null;
}

interface ModalFotoEvidenciaProps {
  asistencia: AsistenciaEvidencia | null;
  nombreEstudiante: string;
  onCerrar: () => void;
}

export function ModalFotoEvidencia({
  asistencia,
  nombreEstudiante,
  onCerrar,
}: ModalFotoEvidenciaProps) {
  if (!asistencia) return null;

  const tieneFotoEntrada = Boolean(asistencia.fotoEntrada || (!asistencia.fotoSalida && asistencia.fotoUrl));
  const tieneFotoSalida = Boolean(asistencia.fotoSalida);

  const [tabFoto, setTabFoto] = React.useState<"ENTRADA" | "SALIDA">(
    tieneFotoEntrada ? "ENTRADA" : tieneFotoSalida ? "SALIDA" : "ENTRADA"
  );

  const urlFoto = tabFoto === "ENTRADA"
    ? (asistencia.fotoEntrada || asistencia.fotoUrl)
    : (asistencia.fotoSalida || asistencia.fotoUrl);

  const fechaFormateada = new Date(asistencia.fecha).toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const horaEntradaStr = asistencia.horaEntrada
    ? new Date(asistencia.horaEntrada).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "No registrada";

  const horaSalidaStr = asistencia.horaSalida
    ? new Date(asistencia.horaSalida).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : asistencia.estadoJornada === "SIN_SALIDA"
    ? "Sin marcación (No registrada)"
    : "En colegio (Pendiente)";

  const jornadaBadgeColor =
    asistencia.estadoJornada === "CERRADA"
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : asistencia.estadoJornada === "SIN_SALIDA"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-emerald-100 text-emerald-800 border-emerald-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6 animate-in fade-in zoom-in duration-200">
        {/* Cabecera Granate */}
        <div className="bg-gradient-to-r from-slate-950 to-red-950 text-white p-5 flex items-center justify-between border-b-2 border-amber-400">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
              <span>📸</span>
              <span>Evidencia Fotográfica de Portería</span>
            </div>
            <h3 className="text-base font-black text-white truncate max-w-xs">
              {nombreEstudiante}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 leading-none"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo con la Fotografía */}
        <div className="p-6 space-y-4">
          {/* Selector de foto Entrada / Salida si ambas existen */}
          {tieneFotoEntrada && tieneFotoSalida && (
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-black">
              <button
                type="button"
                onClick={() => setTabFoto("ENTRADA")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  tabFoto === "ENTRADA"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📸 Foto de Entrada
              </button>
              <button
                type="button"
                onClick={() => setTabFoto("SALIDA")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  tabFoto === "SALIDA"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                👋 Foto de Salida
              </button>
            </div>
          )}

          {/* Contenedor de la Foto */}
          <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
            {urlFoto ? (
              <img
                src={urlFoto}
                alt={`Evidencia de asistencia (${tabFoto}) de ${nombreEstudiante}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-8 text-slate-400">
                <span className="text-4xl block mb-2">📷</span>
                <p className="font-bold text-sm">Fotografía no disponible</p>
                <p className="text-xs text-slate-500 mt-1">
                  Este registro fue validado sin captura de foto en este movimiento.
                </p>
              </div>
            )}

            {/* Badge superpuesto en la foto */}
            {urlFoto && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-950/80 backdrop-blur-sm px-3 py-1.5 rounded-xl text-white text-xs border border-white/10">
                <span className="font-mono text-[11px] text-amber-300">
                  🕒 {tabFoto === "ENTRADA" ? horaEntradaStr : horaSalidaStr}
                </span>
                <span className="font-black text-[10px] uppercase tracking-wider text-emerald-400">
                  {tabFoto === "ENTRADA" ? `ENTRADA · ${asistencia.estado}` : `SALIDA · ${asistencia.estadoSalida || "REGISTRADA"}`}
                </span>
              </div>
            )}
          </div>

          {/* Ficha de Detalles */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Fecha</p>
              <p className="font-bold text-slate-800 capitalize mt-0.5">
                {fechaFormateada}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Estado de Jornada</p>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-black text-[10px] uppercase border ${jornadaBadgeColor}`}
              >
                {asistencia.estadoJornada || "ABIERTA"}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Hora de Entrada</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {horaEntradaStr}{" "}
                <span className="text-[10px] font-black text-emerald-600">({asistencia.estado})</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Hora de Salida</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {horaSalidaStr}{" "}
                {asistencia.estadoSalida && (
                  <span className={`text-[10px] font-black ${
                    asistencia.estadoSalida === "FUERA_HORARIO" ? "text-amber-600" : "text-blue-600"
                  }`}>
                    ({asistencia.estadoSalida})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Pie de autenticidad */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-900">
            <span className="text-base">🛡️</span>
            <span>
              Fotografía capturada automáticamente en portería de la <strong>I.E.P. Santa Rita de Cassia</strong> y respaldada en la nube.
            </span>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
          >
            Cerrar Evidencia
          </button>
        </div>
      </div>
    </div>
  );
}
