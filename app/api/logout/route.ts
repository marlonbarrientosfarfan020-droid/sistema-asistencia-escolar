import { NextResponse } from "next/server";
import { eliminarSesion } from "@/lib/auth";

export async function POST() {
  try {
    await eliminarSesion();

    return NextResponse.json({
      ok: true,
      message: "Sesión cerrada correctamente",
    });
  } catch (error) {
    console.error("Error cerrando sesión:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error al cerrar sesión",
      },
      { status: 500 }
    );
  }
}