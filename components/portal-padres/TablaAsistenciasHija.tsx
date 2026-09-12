"use client";

import React, { useState } from "react";
import { AsistenciaEvidencia, esUrlEvidenciaValida } from "./ModalFotoEvidencia";

interface TablaAsistenciasHijaProps {
  asistencias: AsistenciaEvidencia[];
  onVerEvidencia: (asistencia: AsistenciaEvidencia) => void;
}

export function TablaAsistenciasHija({
  asistencias,
  onVerEvidencia,
}: TablaAsistenciasHijaProps) {
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

  const filtradas = asistencias.filter((a) => {
    if (filtroEstado === "PUNTUAL") return a.estado === "PUNTUAL";
    if (filtroEstado === "TARDANZA") return a.estado === "TARDANZA" || a.estado === "TARDE";
    if (filtroEstado === "AUSENTE") return a.estado === "AUSENTE" || a.estado === "FALTA";
    return true;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Cabecera de la tabla */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span>📋</span> Historial Detallado de Asistencia
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro cronológico de entradas, salidas y fotografías de evidencia tomadas en portería.
          </p>
        </div>

        {/* Filtro rápido */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          {["TODOS", "PUNTUAL", "TARDANZA", "AUSENTE"].map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              className={`px-3 py-1 rounded-lg transition ${
                filtroEstado === est
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {est === "TODOS"
                ? "Todos"
                : est === "PUNTUAL"
                ? "Puntuales"
                : est === "TARDANZA"
                ? "Tardanzas"
                : "Inasistencias"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Fecha</th>
              <th className="py-3.5 px-4">Hora de Entrada</th>
              <th className="py-3.5 px-4">Hora de Salida</th>
              <th className="py-3.5 px-4">Estado Jornada</th>
              <th className="py-3.5 px-4">Método</th>
              <th className="py-3.5 px-4 text-center">Evidencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="text-3xl mb-2">📅</div>
                  <p className="font-bold text-sm text-slate-600">
                    No se registran asistencias para este filtro
                  </p>
                  <p className="text-xs mt-0.5">
                    Las marcaciones aparecerán en tiempo real a medida que su hija ingrese al colegio.
                  </p>
                </td>
              </tr>
            ) : (
              filtradas.map((asist) => {
                const esAusente = asist.estado === "AUSENTE" || asist.estado === "FALTA";

                const fecha = new Date(asist.fecha).toLocaleDateString("es-PE", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                const horaEntrada = asist.horaEntrada
                  ? new Date(asist.horaEntrada).toLocaleTimeString("es-PE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--";

                const horaSalida = asist.horaSalida
                  ? new Date(asist.horaSalida).toLocaleTimeString("es-PE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : esAusente
                  ? "--:--"
                  : asist.estadoJornada === "SIN_SALIDA"
                  ? "Sin salida"
                  : "En colegio";

                const tieneFoto = Boolean(
                  esUrlEvidenciaValida(asist.fotoEntrada) ||
                  esUrlEvidenciaValida(asist.fotoSalida) ||
                  esUrlEvidenciaValida(asist.fotoUrl)
                );

                return (
                  <tr key={asist.id} className={`transition ${esAusente ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-slate-50/80"}`}>
                    {/* Fecha */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 capitalize">
                        {fecha}
                      </p>
                    </td>

                    {/* Hora de Entrada y Estado */}
                    <td className="py-3.5 px-4">
                      {esAusente ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-xs">--:--</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                            🔴 AUSENTE (Inasistencia confirmada)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {horaEntrada}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              asist.estado === "PUNTUAL"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {asist.estado}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Hora de Salida */}
                    <td className="py-3.5 px-4">
                      {esAusente ? (
                        <span className="font-mono text-slate-400 text-xs">--:--</span>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono text-xs ${
                                asist.horaSalida
                                  ? "font-bold text-slate-800"
                                  : "font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md"
                              }`}
                            >
                              {horaSalida}
                            </span>
                            {asist.estadoSalida === "FUERA_HORARIO" && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                                Fuera Horario
                              </span>
                            )}
                          </div>
                          {asist.estadoSalida === "SALIDA_EXCEPCIONAL" && (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                ⚠️ Salida Excepcional
                              </span>
                              {asist.salidaExcepcional && (
                                <div className="mt-1 p-1.5 rounded-lg bg-amber-50/90 border border-amber-200 text-[10px] text-amber-950 max-w-xs space-y-0.5">
                                  <p>
                                    <strong>Motivo:</strong>{" "}
                                    {asist.salidaExcepcional.motivo.replaceAll("_", " ")}
                                    {asist.salidaExcepcional.motivoDetalle && ` (${asist.salidaExcepcional.motivoDetalle})`}
                                  </p>
                                  <p className="italic text-slate-700">
                                    &quot;{asist.salidaExcepcional.observacion}&quot;
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Estado de Jornada */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          esAusente
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : asist.estadoSalida === "SALIDA_EXCEPCIONAL"
                            ? "bg-amber-50 text-amber-900 border-amber-300"
                            : asist.estadoJornada === "CERRADA"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : asist.estadoJornada === "SIN_SALIDA"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        <span>
                          {esAusente
                            ? "🔴"
                            : asist.estadoSalida === "SALIDA_EXCEPCIONAL"
                            ? "⚠️"
                            : asist.estadoJornada === "CERRADA"
                            ? "🔵"
                            : asist.estadoJornada === "SIN_SALIDA"
                            ? "🟠"
                            : "🟢"}
                        </span>
                        <span>
                          {esAusente
                            ? "Inasistencia"
                            : asist.estadoSalida === "SALIDA_EXCEPCIONAL"
                            ? "Salida Excepcional"
                            : asist.estadoJornada === "CERRADA"
                            ? "Cerrada"
                            : asist.estadoJornada === "SIN_SALIDA"
                            ? "Sin Salida"
                            : "En Colegio"}
                        </span>
                      </span>
                    </td>

                    {/* Método */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <span>{asist.metodo === "QR" ? "📱" : asist.metodo === "FACIAL" ? "👤" : asist.metodo === "DNI" ? "💳" : "⚙️"}</span>
                        <span>{asist.metodo}</span>
                      </span>
                    </td>

                    {/* Evidencia Fotográfica */}
                    <td className="py-3.5 px-4 text-center">
                      {esAusente ? (
                        <span className="text-slate-400 text-[11px] font-medium italic">Sin registro</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onVerEvidencia(asist)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm ${
                            tieneFoto
                              ? "bg-gradient-to-r from-red-900 to-red-950 text-white hover:from-red-800 hover:to-red-900 border border-red-800"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                          title="Ver fotografía de evidencia de portería"
                        >
                          <span>📸</span>
                          <span>{tieneFoto ? "Ver Foto" : "Detalle"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
