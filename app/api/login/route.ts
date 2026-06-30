import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const usuario = String(body.usuario || "").trim();
    const password = String(body.password || "").trim();

    if (!usuario || !password) {
      return NextResponse.json(
        { message: "Usuario y contraseña son obligatorios" },
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
        { message: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    if (!usuarioEncontrado.estado) {
      return NextResponse.json(
        { message: "Este usuario está inactivo" },
        { status: 403 }
      );
    }

    const passwordCorrecto = await bcrypt.compare(
      password,
      usuarioEncontrado.password
    );

    if (!passwordCorrecto) {
      return NextResponse.json(
        { message: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: "Login correcto",
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}