export type TipoDispositivoTerminal = "TABLET_CELULAR" | "LAPTOP_PC";

export type EstadoConexionTerminal = "ONLINE" | "OFFLINE" | "MANTENIMIENTO";

export type PerfilCalidadCamara = "AUTO" | "COMPATIBLE" | "HD" | "FULL_HD" | "NATIVA";

export type TerminalConfig = {
  terminalId: string;
  nombreTerminal: string;
  tipoDispositivo: TipoDispositivoTerminal;
  camaraSeleccionada: string;
  modoCamaraPreferido: "environment" | "user";
  resolucionPreferida?: "1080p" | "720p" | "480p" | "auto" | "compatible" | "nativa";
  perfilCalidad?: PerfilCalidadCamara;
  estadoTerminal: EstadoConexionTerminal;
  ultimaConexion?: string;
  colegioId?: string;
};

export type CamaraDispositivo = {
  deviceId: string;
  label: string;
  kind?: string;
  esVirtual?: boolean;
};
