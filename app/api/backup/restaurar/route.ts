import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function esAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function POST(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const formData = await request.formData();
    const archivo = formData.get("archivo") as File;

    if (!archivo) {
      return NextResponse.json(
        { message: "Debe subir un archivo backup .json" },
        { status: 400 }
      );
    }

    const texto = await archivo.text();
    const backup = JSON.parse(texto);

    if (!backup.estudiantes || !backup.turnos || !backup.asistencias) {
      return NextResponse.json(
        { message: "El archivo no parece ser un backup válido" },
        { status: 400 }
      );
    }

    await prisma.asistencia.deleteMany();
    await prisma.estudiante.deleteMany();
    await prisma.turno.deleteMany();
    await prisma.configuracion.deleteMany();
    await prisma.auditoria.deleteMany();

    if (backup.turnos?.length) {
      await prisma.turno.createMany({
        data: backup.turnos,
      });
    }

    if (backup.estudiantes?.length) {
      await prisma.estudiante.createMany({
        data: backup.estudiantes,
      });
    }

    if (backup.asistencias?.length) {
      await prisma.asistencia.createMany({
        data: backup.asistencias,
      });
    }

    if (backup.configuracion?.length) {
      await prisma.configuracion.createMany({
        data: backup.configuracion,
      });
    }

    if (backup.auditoria?.length) {
      await prisma.auditoria.createMany({
        data: backup.auditoria,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Backup restaurado correctamente",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al restaurar backup" },
      { status: 500 }
    );
  }
}