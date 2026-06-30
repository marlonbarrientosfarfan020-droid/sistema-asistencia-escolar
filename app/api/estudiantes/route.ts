import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const estudiantes = await prisma.estudiante.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(estudiantes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const codigo = String(body.codigo || "").trim();
    const dni = String(body.dni || "").trim();

    const existeDni = await prisma.estudiante.findUnique({
      where: { dni },
    });

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
      },
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "ID requerido" }, { status: 400 });
    }

    await prisma.estudiante.delete({
      where: {
        id: Number(id),
      },
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const id = Number(body.id);
    const codigo = String(body.codigo || "").trim();
    const dni = String(body.dni || "").trim();

    const existeDni = await prisma.estudiante.findFirst({
      where: {
        dni,
        NOT: {
          id,
        },
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
        NOT: {
          id,
        },
      },
    });

    if (existeCodigo) {
      return NextResponse.json(
        { message: "Ya existe otro estudiante con ese código" },
        { status: 400 }
      );
    }

    const estudiante = await prisma.estudiante.update({
      where: {
        id,
      },
      data: {
        codigo,
        dni,
        nombres: String(body.nombres || "").trim(),
        apellidos: String(body.apellidos || "").trim(),
        grado: String(body.grado || "").trim(),
        seccion: String(body.seccion || "").trim(),
        nombreTutor: String(body.nombreTutor || "").trim(),
        whatsapp: String(body.whatsapp || "").trim(),
      },
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