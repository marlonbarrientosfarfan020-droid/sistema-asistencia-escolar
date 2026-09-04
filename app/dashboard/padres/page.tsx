"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Familia, EstudianteBasico, EstadisticasPadres } from "@/components/padres/types";
import { PadresStats } from "@/components/padres/PadresStats";
import { PadresTable } from "@/components/padres/PadresTable";
import { ModalNuevoCodigo } from "@/components/padres/ModalNuevoCodigo";
import { ModalVincularHermana } from "@/components/padres/ModalVincularHermana";
import { ModalEditarFamilia } from "@/components/padres/ModalEditarFamilia";

export default function PadresPage() {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [estudiantesSinCodigo, setEstudiantesSinCodigo] = useState<EstudianteBasico[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasPadres | null>(null);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [familiaVincular, setFamiliaVincular] = useState<Familia | null>(null);
  const [familiaEditar, setFamiliaEditar] = useState<Familia | null>(null);

  // Mensajes / Feedback
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const mostrarMensaje = (tipo: "exito" | "error", texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set("q", busqueda.trim());
      if (filtroEstado !== "TODOS") params.set("estado", filtroEstado);

      const res = await fetch(`/api/padres?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarMensaje("error", data.message || "Error al cargar datos de familias");
        return;
      }

      setFamilias(data.familias || []);
      setEstudiantesSinCodigo(data.estudiantesSinCodigo || []);
      setEstadisticas(data.estadisticas || null);
    } catch (error) {
      console.error("Error al cargar familias:", error);
      mostrarMensaje("error", "No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroEstado]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos();
    }, 250);

    return () => clearTimeout(timer);
  }, [cargarDatos]);

  // Alternar estado activo / suspendido
  async function handleToggleEstado(familia: Familia) {
    try {
      const nuevoEstado = !familia.estado;
      const res = await fetch(`/api/padres/${familia.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarMensaje("error", data.message || "Error al cambiar estado");
        return;
      }

      mostrarMensaje(
        "exito",
        `Familia ${familia.codigo} ${nuevoEstado ? "habilitada" : "suspendida"} correctamente`
      );
      cargarDatos();
    } catch (error) {
      console.error("Error toggling estado:", error);
      mostrarMensaje("error", "Error al actualizar estado");
    }
  }

  // Regenerar código familiar
  async function handleRegenerarCodigo(familia: Familia) {
    const confirma = window.confirm(
      `¿Está seguro de regenerar el código familiar para "${familia.tutorTitular || familia.codigo}"?\n\n` +
      `El código anterior "${familia.codigo}" dejará de funcionar de inmediato.`
    );
    if (!confirma) return;

    try {
      const res = await fetch(`/api/padres/${familia.id}/regenerar`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarMensaje("error", data.message || "Error al regenerar código");
        return;
      }

      mostrarMensaje("exito", `Nuevo código generado: ${data.nuevoCodigo}`);
      cargarDatos();
    } catch (error) {
      console.error("Error regenerando código:", error);
      mostrarMensaje("error", "Error al regenerar código");
    }
  }

  // Eliminar familia
  async function handleEliminarFamilia(familia: Familia) {
    const confirma = window.confirm(
      `¿Desea eliminar el código familiar "${familia.codigo}"?\n\n` +
      `Las alumnas vinculadas NO serán eliminadas del colegio, solo quedarán sin código asignado.`
    );
    if (!confirma) return;

    try {
      const res = await fetch(`/api/padres/${familia.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarMensaje("error", data.message || "Error al eliminar código familiar");
        return;
      }

      mostrarMensaje("exito", `Código ${familia.codigo} eliminado correctamente`);
      cargarDatos();
    } catch (error) {
      console.error("Error eliminando familia:", error);
      mostrarMensaje("error", "Error al eliminar código");
    }
  }

  // Desvincular una alumna
  async function handleDesvincularEstudiante(
    familia: Familia,
    estudianteId: number,
    nombreEstudiante: string
  ) {
    const confirma = window.confirm(
      `¿Desvincular a "${nombreEstudiante}" del código familiar "${familia.codigo}"?`
    );
    if (!confirma) return;

    try {
      const res = await fetch(
        `/api/padres/${familia.id}/estudiantes?estudianteId=${estudianteId}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok) {
        mostrarMensaje("error", data.message || "Error al desvincular estudiante");
        return;
      }

      mostrarMensaje("exito", "Estudiante desvinculada exitosamente");
      cargarDatos();
    } catch (error) {
      console.error("Error desvinculando estudiante:", error);
      mostrarMensaje("error", "Error al desvincular estudiante");
    }
  }

  // Ejecución masiva para estudiantes pendientes
  async function handleEjecutarMasivo() {
    const confirma = window.confirm(
      `⚡ ASIGNACIÓN MASIVA DE CÓDIGOS FAMILIARES\n\n` +
      `¿Desea autogenerar códigos para las ${estudiantesSinCodigo.length} alumnas pendientes?\n\n` +
      `El sistema agrupará inteligentemente a las hermanas que compartan el mismo teléfono o nombre de apoderado bajo un mismo código familiar.`
    );
    if (!confirma) return;

    try {
      mostrarMensaje("exito", "⏳ Procesando asignación masiva...");
      const res = await fetch("/api/padres/generar-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agruparPorTutor: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        mostrarMensaje("error", data.message || "Error en asignación masiva");
        return;
      }

      mostrarMensaje(
        "exito",
        `✅ ${data.familiasCreadas} familias creadas y ${data.alumnasVinculadas} alumnas vinculadas`
      );
      cargarDatos();
    } catch (error) {
      console.error("Error en asignación masiva:", error);
      mostrarMensaje("error", "Error en asignación masiva");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 flex items-center gap-3">
            <span>👨‍👩‍👧</span> Gestión de Familias y Portal de Padres
          </h1>
          <p className="text-slate-600 mt-1.5 text-sm sm:text-base">
            Administre los códigos familiares únicos (<span className="font-mono font-bold text-slate-800">SR-2026-XXXX</span>) para que los apoderados consulten la asistencia y fotografías de evidencia de sus hijas.
          </p>
        </div>
      </div>

      {/* Alerta de notificación */}
      {mensaje && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
            mensaje.tipo === "exito"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{mensaje.tipo === "exito" ? "✅" : "❌"}</span>
            <span>{mensaje.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensaje(null)}
            className="text-xs underline hover:opacity-70"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* KPIs de Familias */}
      <PadresStats
        estadisticas={estadisticas}
        cargando={cargando && !estadisticas}
      />

      {/* Tabla Principal */}
      <PadresTable
        familias={familias}
        cargando={cargando}
        busqueda={busqueda}
        onCambiarBusqueda={setBusqueda}
        filtroEstado={filtroEstado}
        onCambiarFiltroEstado={setFiltroEstado}
        onAbrirNuevo={() => setModalNuevoAbierto(true)}
        onAbrirVincular={(fam) => setFamiliaVincular(fam)}
        onAbrirEditar={(fam) => setFamiliaEditar(fam)}
        onRegenerarCodigo={handleRegenerarCodigo}
        onEliminarFamilia={handleEliminarFamilia}
        onDesvincularEstudiante={handleDesvincularEstudiante}
        onToggleEstado={handleToggleEstado}
        onEjecutarMasivo={handleEjecutarMasivo}
        alumnasSinCodigoCount={estudiantesSinCodigo.length}
      />

      {/* Modal Nuevo Código */}
      <ModalNuevoCodigo
        abierto={modalNuevoAbierto}
        onCerrar={() => setModalNuevoAbierto(false)}
        estudiantesSinCodigo={estudiantesSinCodigo}
        onCreado={(nueva) => {
          mostrarMensaje("exito", `Código ${nueva.codigo} creado exitosamente`);
          cargarDatos();
        }}
      />

      {/* Modal Vincular Hermana */}
      <ModalVincularHermana
        familia={familiaVincular}
        onCerrar={() => setFamiliaVincular(null)}
        estudiantesSinCodigo={estudiantesSinCodigo}
        onVinculada={() => {
          mostrarMensaje("exito", "Hermana vinculada con éxito a la familia");
          cargarDatos();
        }}
      />

      {/* Modal Editar Familia */}
      <ModalEditarFamilia
        familia={familiaEditar}
        onCerrar={() => setFamiliaEditar(null)}
        onActualizado={() => {
          mostrarMensaje("exito", "Datos de la familia actualizados");
          cargarDatos();
        }}
      />
    </div>
  );
}
