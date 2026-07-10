import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardarSesion } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["ADMIN", "DEMO"] as const;

type RolPermitido = (typeof ROLES_PERMITIDOS)[number];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const usuario = String(body.usuario || "").trim();
    const password = String(body.password || "");

    if (!usuario || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario y contraseña son obligatorios",
        },
        { status: 400 }
      );
    }

    const usuarioEncontrado = await prisma.usuario.findUnique({
      where: {
        usuario,
      },
    });

    if (!usuarioEncontrado) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario o contraseña incorrectos",
        },
        { status: 401 }
      );
    }

    if (!usuarioEncontrado.estado) {
      return NextResponse.json(
        {
          ok: false,
          message: "Este usuario está inactivo",
        },
        { status: 403 }
      );
    }

    const passwordCorrecto = await bcrypt.compare(
      password,
      usuarioEncontrado.password
    );

    if (!passwordCorrecto) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario o contraseña incorrectos",
        },
        { status: 401 }
      );
    }

    const rol = String(usuarioEncontrado.rol).toUpperCase();

    if (!ROLES_PERMITIDOS.includes(rol as RolPermitido)) {
      return NextResponse.json(
        {
          ok: false,
          message: "El usuario no tiene un rol permitido",
        },
        { status: 403 }
      );
    }

    await guardarSesion({
      usuarioId: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      rol: rol as RolPermitido,
    });

    return NextResponse.json({
      ok: true,
      message: "Login correcto",
      usuario: {
        id: usuarioEncontrado.id,
        nombre: usuarioEncontrado.usuario,
        rol,
      },
    });
  } catch (error) {
    console.error("Error iniciando sesión:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error al iniciar sesión",
      },
      { status: 500 }
    );
  }
}