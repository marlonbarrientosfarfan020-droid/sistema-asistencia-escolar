import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function validarAdmin(request: Request) {
  const rol = request.headers.get("x-user-role");
  return rol === "ADMIN";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!validarAdmin(request)) return noAutorizado();

  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      usuario: true,
      rol: true,
      estado: true,
      createdAt: true,
    },
  });

  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  if (!validarAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const usuario = String(body.usuario || "").trim();
    const password = String(body.password || "").trim();
    const rol = String(body.rol || "").trim();

    if (!usuario || !password || !rol) {
      return NextResponse.json({ message: "Campos obligatorios" }, { status: 400 });
    }

    const existe = await prisma.usuario.findUnique({ where: { usuario } });

    if (existe) {
      return NextResponse.json({ message: "Usuario ya existe" }, { status: 400 });
    }

    const passwordCifrado = await bcrypt.hash(password, 10);

    const nuevo = await prisma.usuario.create({
      data: {
        usuario,
        password: passwordCifrado,
        rol,
        estado: true,
      },
      select: {
        id: true,
        usuario: true,
        rol: true,
        estado: true,
        createdAt: true,
      },
    });

    return NextResponse.json(nuevo, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error al crear usuario" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!validarAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const id = Number(body.id);
    const usuario = String(body.usuario || "").trim();
    const rol = String(body.rol || "").trim();
    const estado = Boolean(body.estado);
    const password = String(body.password || "").trim();

    if (!id || !usuario || !rol) {
      return NextResponse.json({ message: "Campos obligatorios" }, { status: 400 });
    }

    const existe = await prisma.usuario.findFirst({
      where: {
        usuario,
        NOT: { id },
      },
    });

    if (existe) {
      return NextResponse.json(
        { message: "Ya existe otro usuario con ese nombre" },
        { status: 400 }
      );
    }

    const dataActualizar: any = {
      usuario,
      rol,
      estado,
    };

    if (password) {
      dataActualizar.password = await bcrypt.hash(password, 10);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id },
      data: dataActualizar,
      select: {
        id: true,
        usuario: true,
        rol: true,
        estado: true,
        createdAt: true,
      },
    });

    return NextResponse.json(usuarioActualizado);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validarAdmin(request)) return noAutorizado();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "ID requerido" }, { status: 400 });
    }

    await prisma.usuario.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Usuario eliminado" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error al eliminar usuario" }, { status: 500 });
  }
}