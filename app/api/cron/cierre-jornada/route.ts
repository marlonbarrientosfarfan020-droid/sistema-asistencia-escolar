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
  const esCron = esCronAutorizado(request);
  let sesionAdmin = null;

  if (!esCron) {
    sesionAdmin = await exigirAdminODirectivo(request);
  }

  if (!esCron && !sesionAdmin?.autorizado) {
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

    // Seguridad estricta: los cron jobs automáticos NUNCA pueden forzar cierres
    // anticipados. Solo un administrador humano autenticado puede usar 'forzar'.
    const forzarPermitido = Boolean(forzar) && !esCron && Boolean(sesionAdmin?.autorizado);

    const resultado = await ejecutarCierreJornadasVencidas({
      colegioId: colegioId || "SANTA_RITA_001",
      fechaDiaFiltro: fechaDia,
      turnoIdFiltro: turnoId ? Number(turnoId) : undefined,
      forzarCierre: forzarPermitido,
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
