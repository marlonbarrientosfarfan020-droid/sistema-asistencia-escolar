import { NextResponse } from "next/server";
import { revisarAusentes } from "@/services/alertaService";
import { exigirAdmin } from "@/lib/auth";
import { esCronAutorizado } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accesoCron = esCronAutorizado(request);

  if (!accesoCron) {
    const acceso = await exigirAdmin();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }
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