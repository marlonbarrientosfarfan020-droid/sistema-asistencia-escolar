import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function obtenerRol(request: Request) {
  return request.headers.get("x-user-role") || "";
}

function esAdmin(request: Request) {
  return obtenerRol(request) === "ADMIN";
}

function esAdminODemo(request: Request) {
  const rol = obtenerRol(request);
  return rol === "ADMIN" || rol === "DEMO";
}

function noAutorizado() {
  return NextResponse.json(
    { message: "No autorizado" },
    { status: 401 }
  );
}

export async function GET(request: Request) {
  if (!esAdminODemo(request)) return noAutorizado();

  const turnos = await prisma.turno.findMany({
    orderBy: {
      id: "asc",
    },
  });

  return NextResponse.json(turnos);
}

export async function PUT(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();

    const id = Number(body.id);

    const turno = await prisma.turno.update({
      where: { id },
      data: {
        nombre: String(body.nombre || "").trim(),
        horaEntrada: String(body.horaEntrada || "").trim(),
        horaSalida: String(body.horaSalida || "").trim(),
        estado: Boolean(body.estado),
      },
    });

    return NextResponse.json(turno);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al actualizar turno" },
      { status: 500 }
    );
  }
}