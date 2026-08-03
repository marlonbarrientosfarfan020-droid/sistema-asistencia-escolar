import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sesion = await obtenerSesion();

    if (!sesion) {
      return NextResponse.json(
        {
          autenticado: false,
          usuario: null,
        },
        {
          status: 401,

          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        autenticado: true,

        usuario: {
          id: sesion.usuarioId,
          nombre: sesion.usuario,
          rol: sesion.rol,
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error consultando sesión:",
      error
    );

    return NextResponse.json(
      {
        autenticado: false,
        usuario: null,
        message:
          "No se pudo comprobar la sesión",
      },
      {
        status: 500,
      }
    );
  }
}