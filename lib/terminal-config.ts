import { TerminalConfig } from "@/types/terminal";

const STORAGE_KEY_TERMINAL = "configuracion_terminal_escolar";

export function detectarTipoDispositivo(): "LAPTOP_PC" | "TABLET_CELULAR" {
  if (typeof window === "undefined") return "LAPTOP_PC";
  const ua = navigator.userAgent.toLowerCase();
  const esMovil = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  return esMovil ? "TABLET_CELULAR" : "LAPTOP_PC";
}

export const CONFIGURACION_TERMINAL_DEFAULT: TerminalConfig = {
  terminalId: "PUERTA_PRINCIPAL_01",
  nombreTerminal: "Puerta Principal",
  tipoDispositivo: "LAPTOP_PC",
  camaraSeleccionada: "",
  modoCamaraPreferido: "user",
  estadoTerminal: "ONLINE",
  colegioId: "SANTA_RITA_001",
};

/**
 * Obtiene la configuración activa del terminal.
 * Diseñado con una capa de abstracción para permitir migración futura a base de datos.
 */
export function obtenerConfiguracionTerminal(): TerminalConfig {
  if (typeof window === "undefined") {
    return { ...CONFIGURACION_TERMINAL_DEFAULT };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TERMINAL);
    if (!raw) {
      return { ...CONFIGURACION_TERMINAL_DEFAULT };
    }

    const parsed = JSON.parse(raw);
    return {
      ...CONFIGURACION_TERMINAL_DEFAULT,
      ...parsed,
      ultimaConexion: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("Error leyendo configuración del terminal escolar:", error);
    return { ...CONFIGURACION_TERMINAL_DEFAULT };
  }
}

/**
 * Guarda la configuración del terminal de forma local y actualiza última conexión.
 * Preparado para enviar un payload a API remota cuando se implemente en BD.
 */
export function guardarConfiguracionTerminal(
  parcial: Partial<TerminalConfig>
): TerminalConfig {
  if (typeof window === "undefined") {
    return { ...CONFIGURACION_TERMINAL_DEFAULT, ...parcial };
  }

  try {
    const actual = obtenerConfiguracionTerminal();
    const actualizada: TerminalConfig = {
      ...actual,
      ...parcial,
      ultimaConexion: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY_TERMINAL, JSON.stringify(actualizada));

    // Compatibilidad con keys históricas de cámara
    if (actualizada.camaraSeleccionada) {
      localStorage.setItem("camara_qr_device_id", actualizada.camaraSeleccionada);
    }

    return actualizada;
  } catch (error) {
    console.error("Error guardando configuración del terminal escolar:", error);
    return { ...CONFIGURACION_TERMINAL_DEFAULT, ...parcial };
  }
}
