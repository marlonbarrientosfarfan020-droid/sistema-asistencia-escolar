import { NextResponse } from "next/server";
import { revisarAusentes } from "@/services/alertaService";
import { exigirAdminODirectivo } from "@/lib/auth";
import { esCronAutorizado } from "@/lib/cronAuth";
import { verificarModuloActivo } from "@/lib/supermotor-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accesoCron = esCronAutorizado(request);

  if (!accesoCron) {
    const acceso = await exigirAdminODirectivo(request);

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }
  }

  // FASE 5.2: Validar alertasActivo en el SuperMotor
  const estadoAlertas = await verificarModuloActivo("alertas");
  if (!estadoAlertas.autorizado) {
    return NextResponse.json({
      ok: false,
      estado: "bloqueado",
      message: "Módulo de alertas desactivado en el SuperMotor",
      alertasEnviadas: 0,
    });
  }

  try {
    const resultado = await revisarAusentes();

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error revisando ausentes:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error al revisar estudiantes ausentes",
      },
      { status: 500 }
    );
  }
}