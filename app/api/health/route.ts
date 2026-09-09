import { NextResponse } from "next/server";
import { obtenerDiagnosticoCompleto } from "@/lib/health";
import { resolverColegio } from "@/lib/tenant";
import { obtenerSesion } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FASE 13.5: API DE SALUD DEL SISTEMA (/api/health)
 * Endpoint de observabilidad para monitorización de producción y healthchecks.
 */
export async function GET(request: Request) {
  try {
    const sesion = await obtenerSesion(request);
    const tenant = resolverColegio(sesion, request);
    const colegioId = tenant.ok ? tenant.context.colegioId : "SANTA_RITA_001";

    const diagnostico = await obtenerDiagnosticoCompleto(colegioId);

    // Formato estándar requerido en la especificación
    return NextResponse.json({
      sistema: diagnostico.sistema,
      database: diagnostico.servicios.database.estado === "OK" ? "OK" : "ERROR",
      supermotor: diagnostico.servicios.supermotor.motorActivo ? "ACTIVO" : "APAGADO",
      cron: diagnostico.servicios.cron.estado,
      timestamp: `${diagnostico.timestamp} (hora Peru)`,
      colegioId: diagnostico.colegioId,
      servicios: diagnostico.servicios,
      alertas: diagnostico.alertas,
      historial: diagnostico.historialEventos,
    });
  } catch (error: any) {
    console.error("[API HEALTH] Error ejecutando healthcheck:", error);
    return NextResponse.json(
      {
        sistema: "ERROR",
        database: "ERROR",
        supermotor: "DESCONOCIDO",
        cron: "ERROR",
        mensaje: error?.message || "Fallo en diagnóstico de salud",
      },
      { status: 500 }
    );
  }
}
