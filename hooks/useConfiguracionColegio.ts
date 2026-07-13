"use client";

import { useCallback, useEffect, useState } from "react";

export type ConfiguracionColegio = {
  nombreColegio: string;
  logoUrl: string;
  direccion: string;
  telefono: string;
  correo: string;
  director: string;
};

const CONFIGURACION_INICIAL: ConfiguracionColegio = {
  nombreColegio: "Institución educativa",
  logoUrl: "",
  direccion: "",
  telefono: "",
  correo: "",
  director: "",
};

export function useConfiguracionColegio() {
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionColegio>(CONFIGURACION_INICIAL);

  const [cargando, setCargando] = useState(true);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const respuesta = await fetch(
        `/api/configuracion/publica?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        }
      );

      const texto = await respuesta.text();

      if (!respuesta.ok || !texto) {
        throw new Error(
          "No se pudo cargar la configuración institucional"
        );
      }

      const data = JSON.parse(texto);

      setConfiguracion({
        nombreColegio:
          String(data.nombreColegio || "").trim() ||
          "Institución educativa",

        logoUrl: String(data.logoUrl || "").trim(),
        direccion: String(data.direccion || "").trim(),
        telefono: String(data.telefono || "").trim(),
        correo: String(data.correo || "").trim(),
        director: String(data.director || "").trim(),
      });
    } catch (error) {
      console.error(
        "Error cargando configuración institucional:",
        error
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();

    const actualizarConfiguracion = () => {
      cargarConfiguracion();
    };

    window.addEventListener(
      "configuracion-colegio-actualizada",
      actualizarConfiguracion
    );

    return () => {
      window.removeEventListener(
        "configuracion-colegio-actualizada",
        actualizarConfiguracion
      );
    };
  }, [cargarConfiguracion]);

  return {
    configuracion,
    cargando,
    recargarConfiguracion: cargarConfiguracion,
  };
}