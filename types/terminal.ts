export type TipoDispositivoTerminal = "TABLET_CELULAR" | "LAPTOP_PC";

export type EstadoConexionTerminal = "ONLINE" | "OFFLINE" | "MANTENIMIENTO";

export type TerminalConfig = {
  terminalId: string;
  nombreTerminal: string;
  tipoDispositivo: TipoDispositivoTerminal;
  camaraSeleccionada: string;
  modoCamaraPreferido: "environment" | "user";
  estadoTerminal: EstadoConexionTerminal;
  ultimaConexion?: string;
  colegioId?: string;
};

export type CamaraDispositivo = {
  deviceId: string;
  label: string;
  kind?: string;
};
