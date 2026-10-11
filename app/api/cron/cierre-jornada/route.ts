import { NextResponse } from "next/server";
import { esCronAutorizado, respuestaCronNoAutorizado } from "@/lib/cronAuth";
import { exigirAdminODirectivo } from "@/lib/auth";
import { ejecutarCierreJornadasVencidas } from "@/services/jornada/cierreJornadaService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/cierre-jornada
 * Endpoint institucional para el cierre automático de turnos y registros sin salida.
 * Autorizado para cron jobs Vercel / GitHub Actions (CRON_SECRET) o administradores escolares.
 */
export async function POST(request: Request) {
  let autorizado = esCronAutorizado(request);

  if (!autorizado) {
    const sesionAdmin = await exigirAdminODirectivo(request);
    autorizado = sesionAdmin.autorizado;
  }

  if (!autorizado) {
    return respuestaCronNoAutorizado();
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body opcional
    }

    const { colegioId, fechaDia, turnoId, forzar } = body;

    const resultado = await ejecutarCierreJornadasVencidas({
      colegioId: colegioId || "SANTA_RITA_001",
      fechaDiaFiltro: fechaDia,
      turnoIdFiltro: turnoId ? Number(turnoId) : undefined,
      forzarCierre: Boolean(forzar),
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("[CRON CIERRE JORNADA] Error ejecutando cierre:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Error interno al ejecutar cierre automático de jornadas",
        error: error?.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/cierre-jornada
 * Compatibilidad con invocaciones estándar GET de Vercel Cron.
 */
export async function GET(request: Request) {
  return POST(request);
}
