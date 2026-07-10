import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";

export async function GET() {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return NextResponse.json(
      {
        autenticado: false,
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    autenticado: true,
    usuario: {
      id: sesion.usuarioId,
      nombre: sesion.usuario,
      rol: sesion.rol,
    },
  });
}