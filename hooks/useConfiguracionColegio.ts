"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

export type ConfiguracionColegio = {
  nombreColegio: string;
  logoUrl: string;
  direccion: string;
  telefono: string;
  correo: string;
  director: string;
};

const CONFIGURACION_INICIAL: ConfiguracionColegio =
  {
    nombreColegio:
      "Santa Rita de Casia",
    logoUrl: "",
    direccion: "",
    telefono: "",
    correo: "",
    director: "",
  };

export function useConfiguracionColegio() {
  const [
    configuracion,
    setConfiguracion,
  ] =
    useState<ConfiguracionColegio>(
      CONFIGURACION_INICIAL
    );

  const [cargando, setCargando] =
    useState(true);

  const cargarConfiguracion =
    useCallback(async () => {
      try {
        const respuesta = await fetch(
          `/api/configuracion/publica?t=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
          }
        );

        const tipoContenido =
          respuesta.headers.get(
            "content-type"
          ) || "";

        if (
          !tipoContenido.includes(
            "application/json"
          )
        ) {
          const contenido =
            await respuesta.text();

          console.error(
            "Configuración pública no devolvió JSON:",
            {
              status: respuesta.status,
              contenido:
                contenido.slice(0, 200),
            }
          );

          throw new Error(
            "La ruta de configuración pública no está disponible"
          );
        }

        const data =
          await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(
            data.message ||
              "No se pudo cargar la configuración institucional"
          );
        }

        setConfiguracion({
          nombreColegio:
            String(
              data.nombreColegio || ""
            ).trim() ||
            "Santa Rita de Casia",

          logoUrl: String(
            data.logoUrl || ""
          ).trim(),

          direccion: String(
            data.direccion || ""
          ).trim(),

          telefono: String(
            data.telefono || ""
          ).trim(),

          correo: String(
            data.correo || ""
          ).trim(),

          director: String(
            data.director || ""
          ).trim(),
        });
      } catch (error) {
        console.error(
          "Error cargando configuración institucional:",
          error
        );

        setConfiguracion(
          CONFIGURACION_INICIAL
        );
      } finally {
        setCargando(false);
      }
    }, []);

  useEffect(() => {
    cargarConfiguracion();

    function actualizarConfiguracion() {
      cargarConfiguracion();
    }

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
    recargarConfiguracion:
      cargarConfiguracion,
  };
}