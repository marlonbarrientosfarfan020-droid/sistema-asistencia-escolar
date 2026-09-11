import { NextResponse } from "next/server";
import { validarTerminalRequest } from "@/lib/terminal-auth";

export const dynamic = "force-dynamic";

/**
 * GET: Endpoint de handshake para que la terminal verifique si sus credenciales almacenadas son válidas.
 */
export async function GET(request: Request) {
  const resultado = await validarTerminalRequest(request);

  if (!resultado) {
    return NextResponse.json(
      { ok: false, message: "No se enviaron credenciales de terminal (x-terminal-id, x-terminal-token)" },
      { status: 401 }
    );
  }

  if (!resultado.autorizado) {
    return NextResponse.json(
      { ok: false, message: resultado.motivo },
      { status: resultado.status }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Terminal autorizada correctamente",
    terminal: resultado.terminal,
  });
}
