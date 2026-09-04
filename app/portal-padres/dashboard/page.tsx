"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SelectorHijas, EstudianteHija } from "@/components/portal-padres/SelectorHijas";
import { GraficosPadre } from "@/components/portal-padres/GraficosPadre";
import { TablaAsistenciasHija } from "@/components/portal-padres/TablaAsistenciasHija";
import { ModalFotoEvidencia, AsistenciaEvidencia } from "@/components/portal-padres/ModalFotoEvidencia";

interface FamiliaInfo {
  id: number;
  codigo: string;
  tutorTitular: string;
  telefonoContacto: string;
  ultimoIngresoAt?: string | null;
}

interface DatosPortal {
  familia: FamiliaInfo;
  estudiantes: EstudianteHija[];
  estudianteActiva: EstudianteHija;
  metricasEstudiante: {
    totalRegistros: number;
    puntuales: number;
    tardanzas: number;
    justificados: number;
    porcentajePuntualidad: number;
  };
  distribucionDona: Array<{ name: string; valor: number; color: string }>;
  barrasMeses: Array<{ mes: string; puntuales: number; tardanzas: number }>;
  asistencias: AsistenciaEvidencia[];
  infoColegio: {
    nombreColegio: string;
    logoUrl: string;
    telefono: string;
    correo: string;
  };
}

export default function PortalPadresDashboardPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosPortal | null>(null);
  const [estudianteIdSeleccionada, setEstudianteIdSeleccionada] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [evidenciaSeleccionada, setEvidenciaSeleccionada] = useState<AsistenciaEvidencia | null>(null);

  const cargarDatos = useCallback(async (estudianteId?: number) => {
    try {
      setCargando(true);
      const url = estudianteId
        ? `/api/portal-padres/datos?estudianteId=${estudianteId}`
        : "/api/portal-padres/datos";

      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });

      if (res.status === 401) {
        router.replace("/portal-padres");
        return;
      }

      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const json = await res.json();
          if (json && json.ok) {
            setDatos(json);
            setEstudianteIdSeleccionada(json.estudianteActiva.id);
          }
        }
      }
    } catch (error) {
      console.warn("Aviso al cargar datos del portal de familias:", error);
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function handleSeleccionarHija(id: number) {
    if (id === estudianteIdSeleccionada) return;
    setEstudianteIdSeleccionada(id);
    cargarDatos(id);
  }

  async function handleLogout() {
    try {
      setCerrandoSesion(true);
      await fetch("/api/portal-padres/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/portal-padres");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
      router.replace("/portal-padres");
    }
  }

  if (cargando && !datos) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800">
          <span className="animate-spin text-xl">⏳</span>
          <span className="font-bold text-sm">Cargando expediente escolar de su familia...</span>
        </div>
      </main>
    );
  }

  if (!datos) return null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-amber-400 selection:text-slate-950">
      {/* 1. Barra Superior Institucional para Padres */}
      <header className="sticky top-0 z-40 bg-slate-950 text-white border-b-2 border-red-900/60 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo y Familia */}
            <div className="flex items-center gap-3.5">
              <Link href="/" className="shrink-0 group">
                <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md ring-2 ring-amber-400/30 group-hover:ring-amber-400 transition">
                  <Image
                    src={datos.infoColegio.logoUrl || "/img/logo-santa-rita.png"}
                    alt="Escudo Santa Rita"
                    width={48}
                    height={48}
                    className="object-contain w-full h-full"
                  />
                </div>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-white tracking-tight">
                    {datos.infoColegio.nombreColegio}
                  </span>
                  <span className="font-mono text-[10px] font-black uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-400/30">
                    {datos.familia.codigo}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Familia de <strong className="text-white">{datos.familia.tutorTitular || "nuestras alumnas"}</strong>
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden sm:inline-flex text-xs font-bold text-slate-400 hover:text-white transition px-3 py-2 rounded-xl hover:bg-slate-900"
              >
                Portada Web
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={cerrandoSesion}
                className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>🚪</span>
                <span>{cerrandoSesion ? "Saliendo..." : "Cerrar Sesión"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        {/* Selector de Hijas */}
        <SelectorHijas
          estudiantes={datos.estudiantes}
          estudianteActivaId={datos.estudianteActiva.id}
          onSeleccionarHija={handleSeleccionarHija}
        />

        {/* Gráficos y Métricas de la Estudiante */}
        <GraficosPadre
          metricas={datos.metricasEstudiante}
          distribucion={datos.distribucionDona}
          barrasMeses={datos.barrasMeses}
        />

        {/* Tabla Detallada con Botón de Evidencia */}
        <TablaAsistenciasHija
          asistencias={datos.asistencias}
          onVerEvidencia={(asist) => setEvidenciaSeleccionada(asist)}
        />
      </main>

      {/* 3. Modal de Evidencia Fotográfica */}
      <ModalFotoEvidencia
        asistencia={evidenciaSeleccionada}
        nombreEstudiante={`${datos.estudianteActiva.nombres} ${datos.estudianteActiva.apellidos}`}
        onCerrar={() => setEvidenciaSeleccionada(null)}
      />

      {/* 4. Footer del Portal */}
      <footer className="bg-slate-950 text-white border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>
          I.E.P. Santa Rita de Cassia · San Vicente de Cañete, Perú
        </p>
        <p className="text-slate-600 mt-1 text-[11px]">
          Plataforma Segura de Asistencia Escolar · Fotografías y Registros en Tiempo Real
        </p>
      </footer>
    </div>
  );
}
