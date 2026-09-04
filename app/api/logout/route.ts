import { NextResponse } from "next/server";
import { eliminarSesion } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "sesion_santa_rita";

export async function POST() {
  try {
    await eliminarSesion();

    const response = NextResponse.json({
      ok: true,
      message: "Sesión cerrada correctamente",
    });

    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("Error cerrando sesión:", error);

    const response = NextResponse.json(
      {
        ok: false,
        message: "Error al cerrar sesión",
      },
      { status: 500 }
    );

    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  }
}


