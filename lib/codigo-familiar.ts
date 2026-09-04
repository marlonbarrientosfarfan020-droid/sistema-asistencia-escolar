import crypto from "crypto";

// Caracteres legibles evitando confusiones (sin 0, O, 1, I)
const CARACTERES = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generarCodigoFamiliar(longitud: number = 4): string {
  const bytes = crypto.randomBytes(longitud);
  let resultado = "";

  for (let i = 0; i < longitud; i++) {
    resultado += CARACTERES[bytes[i] % CARACTERES.length];
  }

  const anio = new Date().getFullYear();
  return `SR-${anio}-${resultado}`;
}

export function formatoCodigoValido(codigo: string): boolean {
  if (!codigo || typeof codigo !== "string") return false;
  return /^SR-\d{4}-[A-Z0-9]{4,6}$/.test(codigo.trim().toUpperCase());
}
