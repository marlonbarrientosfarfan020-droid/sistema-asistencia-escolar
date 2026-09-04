"use client";

import React, { useState } from "react";
import { Familia } from "./types";

interface PadresTableProps {
  familias: Familia[];
  cargando: boolean;
  busqueda: string;
  onCambiarBusqueda: (valor: string) => void;
  filtroEstado: string;
  onCambiarFiltroEstado: (estado: string) => void;
  onAbrirNuevo: () => void;
  onAbrirVincular: (familia: Familia) => void;
  onAbrirEditar: (familia: Familia) => void;
  onRegenerarCodigo: (familia: Familia) => void;
  onEliminarFamilia: (familia: Familia) => void;
  onDesvincularEstudiante: (familia: Familia, estudianteId: number, nombreEstudiante: string) => void;
  onToggleEstado: (familia: Familia) => void;
  onEjecutarMasivo: () => void;
  alumnasSinCodigoCount: number;
}

export function PadresTable({
  familias,
  cargando,
  busqueda,
  onCambiarBusqueda,
  filtroEstado,
  onCambiarFiltroEstado,
  onAbrirNuevo,
  onAbrirVincular,
  onAbrirEditar,
  onRegenerarCodigo,
  onEliminarFamilia,
  onDesvincularEstudiante,
  onToggleEstado,
  onEjecutarMasivo,
  alumnasSinCodigoCount,
}: PadresTableProps) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  function copiarAlPortapapeles(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  function copiarCredencialesFamilia(familia: Familia) {
    const nombresHijas = familia.estudiantes
      .map((e) => `• ${e.nombres} ${e.apellidos} (${e.grado} "${e.seccion}" - DNI: ${e.dni})`)
      .join("\n");

    const dniConsulta = familia.estudiantes.length > 0 ? familia.estudiantes[0].dni : "[DNI]";
    const origen = typeof window !== "undefined" ? window.location.origin : "";

    const mensaje = `🏫 *I.E.P. SANTA RITA DE CASIA - PORTAL FAMILIAR*\n` +
      `Estimada familia de *${familia.tutorTitular || "nuestras alumnas"}*:\n\n` +
      `Ponemos a su disposición el portal web oficial para consultar en tiempo real la asistencia, puntualidad y fotografías de entrada y salida de su(s) hija(s).\n\n` +
      `👧 *Alumna(s) vinculada(s):*\n${nombresHijas || "• Por asignar"}\n\n` +
      `🔐 *Credenciales de acceso:*\n` +
      `• *DNI de la alumna:* ${dniConsulta}\n` +
      `• *Código Familiar Único:* ${familia.codigo}\n\n` +
      `🌐 *Enlace de consulta:* ${origen}/portal-padres\n\n` +
      `_Por seguridad, conserve este código y no lo comparta con personas ajenas a su hogar._`;

    copiarAlPortapapeles(mensaje, `msg-${familia.id}`);
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Barra de herramientas y filtros */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Buscador */}
        <div className="flex-1 max-w-md relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => onCambiarBusqueda(e.target.value)}
            placeholder="Buscar por código (SR-2026-...), alumna, DNI o tutor..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {/* Filtros de estado & Botones de acción */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tabs Estado */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            {["TODOS", "ACTIVO", "INACTIVO"].map((est) => (
              <button
                key={est}
                type="button"
                onClick={() => onCambiarFiltroEstado(est)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filtroEstado === est
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {est === "TODOS" ? "Todos" : est === "ACTIVO" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>

          {/* Botón Masivo */}
          {alumnasSinCodigoCount > 0 && (
            <button
              type="button"
              onClick={onEjecutarMasivo}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
              title="Generar automáticamente códigos familiares para todas las alumnas sin código, agrupando hermanas por tutor o teléfono"
            >
              <span>⚡</span>
              <span>Asignar {alumnasSinCodigoCount} Pendientes</span>
            </button>
          )}

          {/* Botón Nuevo */}
          <button
            type="button"
            onClick={onAbrirNuevo}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>Nuevo Código Familiar</span>
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Código Familiar</th>
              <th className="py-3.5 px-4">Tutor Titular & Contacto</th>
              <th className="py-3.5 px-4">Hijas Vinculadas</th>
              <th className="py-3.5 px-4">Último Ingreso</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="py-4 px-4">
                    <div className="h-6 bg-slate-100 rounded-lg"></div>
                  </td>
                </tr>
              ))
            ) : familias.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="text-3xl mb-2">👨‍👩‍👧</div>
                  <p className="font-bold text-sm text-slate-600">
                    No se encontraron códigos familiares
                  </p>
                  <p className="text-xs mt-1">
                    {busqueda
                      ? "Intente con otro término de búsqueda"
                      : "Genere el primer código familiar haciendo clic en '+ Nuevo Código Familiar'"}
                  </p>
                </td>
              </tr>
            ) : (
              familias.map((fam) => (
                <tr
                  key={fam.id}
                  className="hover:bg-slate-50/80 transition group"
                >
                  {/* Código Familiar */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 tracking-wider">
                        {fam.codigo}
                      </span>
                      <button
                        type="button"
                        onClick={() => copiarAlPortapapeles(fam.codigo, `cod-${fam.id}`)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded transition"
                        title="Copiar código al portapapeles"
                      >
                        {copiadoId === `cod-${fam.id}` ? (
                          <span className="text-emerald-600 font-bold text-[10px]">✓</span>
                        ) : (
                          "📋"
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Tutor Titular & Contacto */}
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">
                      {fam.tutorTitular || <span className="text-slate-400 italic">Sin tutor registrado</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-slate-500">
                      {fam.telefonoContacto ? (
                        <a
                          href={`https://wa.me/51${fam.telefonoContacto.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-600 flex items-center gap-1 font-mono text-[11px]"
                          title="Contactar por WhatsApp"
                        >
                          <span>💬</span>
                          <span>{fam.telefonoContacto}</span>
                        </a>
                      ) : null}
                      {fam.correoContacto ? (
                        <span className="truncate max-w-[150px] text-[11px]" title={fam.correoContacto}>
                          ✉️ {fam.correoContacto}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Hijas Vinculadas */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                      {fam.estudiantes.length === 0 ? (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
                          ⚠️ Sin hijas vinculadas
                        </span>
                      ) : (
                        fam.estudiantes.map((est) => (
                          <span
                            key={est.id}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-lg text-[11px]"
                            title={`DNI: ${est.dni}`}
                          >
                            <span>👩‍🎓</span>
                            <span className="font-semibold">
                              {est.nombres.split(" ")[0]} {est.apellidos.split(" ")[0]}
                            </span>
                            <span className="text-[9px] text-blue-600 font-bold">
                              ({est.grado}-{est.seccion})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onDesvincularEstudiante(
                                  fam,
                                  est.id,
                                  `${est.nombres} ${est.apellidos}`
                                )
                              }
                              className="text-blue-400 hover:text-red-600 hover:bg-red-50 rounded-full w-3.5 h-3.5 flex items-center justify-center ml-0.5 text-[9px] transition"
                              title="Desvincular esta alumna de la familia"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}

                      {/* Botón Vincular otra hermana */}
                      <button
                        type="button"
                        onClick={() => onAbrirVincular(fam)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-slate-100 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition"
                        title="Vincular otra hermana a este código"
                      >
                        + Hermana
                      </button>
                    </div>
                  </td>

                  {/* Último Ingreso */}
                  <td className="py-3.5 px-4">
                    {fam.ultimoIngresoAt ? (
                      <div>
                        <p className="font-semibold text-slate-800">
                          {new Date(fam.ultimoIngresoAt).toLocaleDateString("es-PE")}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(fam.ultimoIngresoAt).toLocaleTimeString("es-PE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">
                        Sin ingresos aún
                      </span>
                    )}
                  </td>

                  {/* Estado Toggle */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleEstado(fam)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase transition ${
                        fam.estado
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                          : "bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300"
                      }`}
                    >
                      {fam.estado ? "Activo" : "Inactivo"}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Copiar Credenciales Formateadas */}
                      <button
                        type="button"
                        onClick={() => copiarCredencialesFamilia(fam)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold transition flex items-center gap-1"
                        title="Copiar credenciales listas para enviar por WhatsApp o Telegram"
                      >
                        {copiadoId === `msg-${fam.id}` ? "¡Copiado! ✓" : "📲 Credenciales"}
                      </button>

                      {/* Regenerar Código */}
                      <button
                        type="button"
                        onClick={() => onRegenerarCodigo(fam)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                        title="Regenerar código familiar"
                      >
                        🔄
                      </button>

                      {/* Editar */}
                      <button
                        type="button"
                        onClick={() => onAbrirEditar(fam)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                        title="Editar datos de contacto"
                      >
                        ✏️
                      </button>

                      {/* Eliminar */}
                      <button
                        type="button"
                        onClick={() => onEliminarFamilia(fam)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 transition"
                        title="Eliminar código familiar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
