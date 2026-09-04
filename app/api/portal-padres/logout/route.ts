import { NextResponse } from "next/server";
import { destruirSesionPadre } from "@/lib/auth-padres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destruirSesionPadre();
    return NextResponse.json({
      ok: true,
      message: "Sesión familiar cerrada exitosamente",
    });
  } catch (error) {
    console.error("Error cerrando sesión familiar:", error);
    return NextResponse.json(
      { ok: false, message: "Error al cerrar sesión" },
      { status: 500 }
    );
  }
}
