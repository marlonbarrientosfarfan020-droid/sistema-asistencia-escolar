import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { RolUsuario } from "@/lib/auth";

/**
 * Genera el hash SHA-256 de un token secreto de terminal.
 */
export function hashTerminalToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Compara dos hashes criptográficos en tiempo constante para prevenir ataques de temporización (timing attacks).
 */
export function compararHashesSeguro(hashA: string, hashB: string): boolean {
  try {
    const bufA = Buffer.from(hashA, "hex");
    const bufB = Buffer.from(hashB, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export type ValidacionTerminalResultado =
  | {
      autorizado: true;
      terminal: {
        id: number;
        terminalId: string;
        nombre: string;
        colegioId: string;
      };
      sesion: {
        usuarioId: number;
        usuario: string;
        rol: RolUsuario;
        colegioId: string;
      };
    }
  | {
      autorizado: false;
      status: number;
      motivo: string;
    };

/**
 * Valida si la solicitud HTTP proviene de una terminal registrada, activa y autorizada.
 * Retorna null si la solicitud no contiene cabeceras de terminal.
 */
export async function validarTerminalRequest(
  request: Request
): Promise<ValidacionTerminalResultado | null> {
  const terminalId = request.headers.get("x-terminal-id")?.trim();
  const terminalToken = request.headers.get("x-terminal-token")?.trim();

  // Si no se envían cabeceras de terminal, delegar al flujo normal de sesión/PIN
  if (!terminalId && !terminalToken) {
    return null;
  }

  if (!terminalId || !terminalToken) {
    return {
      autorizado: false,
      status: 401,
      motivo: "Credenciales de terminal incompletas (se requiere ID y token)",
    };
  }

  try {
    const terminal = await prisma.terminal.findUnique({
      where: { terminalId },
    });

    if (!terminal) {
      return {
        autorizado: false,
        status: 401,
        motivo: "Terminal no registrada o identificador no reconocido",
      };
    }

    if (terminal.estado !== "ACTIVA") {
      return {
        autorizado: false,
        status: 403,
        motivo: `Terminal no autorizada (estado actual: ${terminal.estado})`,
      };
    }

    const hashCalculado = hashTerminalToken(terminalToken);
    const esValido = compararHashesSeguro(hashCalculado, terminal.tokenHash);

    if (!esValido) {
      return {
        autorizado: false,
        status: 401,
        motivo: "Token de autenticación de terminal inválido",
      };
    }

    // Actualizar fecha de última conexión en segundo plano (asíncrono, no bloqueante)
    prisma.terminal
      .update({
        where: { id: terminal.id },
        data: { ultimaConexion: new Date() },
      })
      .catch((err) =>
        console.warn("[TERMINAL AUTH] Error actualizando última conexión:", err?.message)
      );

    return {
      autorizado: true,
      terminal: {
        id: terminal.id,
        terminalId: terminal.terminalId,
        nombre: terminal.nombre,
        colegioId: terminal.colegioId,
      },
      sesion: {
        usuarioId: 0,
        usuario: `terminal_${terminal.terminalId}`,
        rol: "PERSONAL" as RolUsuario,
        colegioId: terminal.colegioId,
      },
    };
  } catch (error: any) {
    console.error("[TERMINAL AUTH] Error validando terminal:", error);
    return {
      autorizado: false,
      status: 500,
      motivo: "Error interno en la verificación de terminal",
    };
  }
}
