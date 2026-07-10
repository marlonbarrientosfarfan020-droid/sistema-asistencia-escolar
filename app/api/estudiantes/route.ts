import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "../../../lib/auditoria";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function obtenerUsuario(request: Request) {
  return request.headers.get("x-user-name") || "Usuario";
}

function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

  const estudiantes = await prisma.estudiante.findMany({
  orderBy: { createdAt: "desc" },
  include: {
    turno: true,
    riesgoIA: true,
  },
});

  return NextResponse.json(estudiantes);
}

export async function POST(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const codigo = String(body.codigo || "").trim();
    const dni = String(body.dni || "").trim();
    const turnoId = body.turnoId ? Number(body.turnoId) : null;

    const existeDni = await prisma.estudiante.findUnique({ where: { dni } });

    if (existeDni) {
      return NextResponse.json(
        { message: "Ya existe un estudiante con ese DNI" },
        { status: 400 }
      );
    }

    const existeCodigo = await prisma.estudiante.findUnique({
      where: { codigo },
    });

    if (existeCodigo) {
      return NextResponse.json(
        { message: "Ya existe un estudiante con ese código" },
        { status: 400 }
      );
    }

    const estudiante = await prisma.estudiante.create({
      data: {
        codigo,
        dni,
        nombres: String(body.nombres || "").trim(),
        apellidos: String(body.apellidos || "").trim(),
        grado: String(body.grado || "").trim(),
        seccion: String(body.seccion || "").trim(),
        nombreTutor: String(body.nombreTutor || "").trim(),
        whatsapp: String(body.whatsapp || "").trim(),
        telegramChatId: String(body.telegramChatId || "").trim(),
        turnoId,
      },
    });

    await registrarAuditoria({
      usuario: obtenerUsuario(request),
      rol: obtenerRol(request),
      accion: "CREAR",
      modulo: "Estudiantes",
      detalle: `Registró al estudiante ${estudiante.nombres} ${estudiante.apellidos} con DNI ${estudiante.dni}`,
    });

    return NextResponse.json(estudiante, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al guardar estudiante" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const id = Number(body.id);
    const codigo = String(body.codigo || "").trim();
    const dni = String(body.dni || "").trim();
    const turnoId = body.turnoId ? Number(body.turnoId) : null;

    const existeDni = await prisma.estudiante.findFirst({
      where: {
        dni,
        NOT: { id },
      },
    });

    if (existeDni) {
      return NextResponse.json(
        { message: "Ya existe otro estudiante con ese DNI" },
        { status: 400 }
      );
    }

    const existeCodigo = await prisma.estudiante.findFirst({
      where: {
        codigo,
        NOT: { id },
      },
    });

    if (existeCodigo) {
      return NextResponse.json(
        { message: "Ya existe otro estudiante con ese código" },
        { status: 400 }
      );
    }

    const estudiante = await prisma.estudiante.update({
      where: { id },
      data: {
        codigo,
        dni,
        nombres: String(body.nombres || "").trim(),
        apellidos: String(body.apellidos || "").trim(),
        grado: String(body.grado || "").trim(),
        seccion: String(body.seccion || "").trim(),
        nombreTutor: String(body.nombreTutor || "").trim(),
        whatsapp: String(body.whatsapp || "").trim(),
        telegramChatId: String(body.telegramChatId || "").trim(),
        turnoId,
      },
    });

    await registrarAuditoria({
      usuario: obtenerUsuario(request),
      rol: obtenerRol(request),
      accion: "EDITAR",
      modulo: "Estudiantes",
      detalle: `Actualizó al estudiante ${estudiante.nombres} ${estudiante.apellidos} con DNI ${estudiante.dni}`,
    });

    return NextResponse.json(estudiante);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al actualizar estudiante" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "ID requerido" }, { status: 400 });
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: {
        id: Number(id),
      },
    });

    await prisma.estudiante.delete({
      where: {
        id: Number(id),
      },
    });

    await registrarAuditoria({
      usuario: obtenerUsuario(request),
      rol: obtenerRol(request),
      accion: "ELIMINAR",
      modulo: "Estudiantes",
      detalle: estudiante
        ? `Eliminó al estudiante ${estudiante.nombres} ${estudiante.apellidos} con DNI ${estudiante.dni}`
        : `Eliminó un estudiante con ID ${id}`,
    });

    return NextResponse.json({
      message: "Estudiante eliminado correctamente",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al eliminar estudiante" },
      { status: 500 }
    );
  }
}