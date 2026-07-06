import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function esAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

function noAutorizado() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!esAdmin(request)) return noAutorizado();

  try {
    const fecha = new Date().toISOString().replace(/[:.]/g, "-");

    const data = {
      generadoEn: new Date(),
      sistema: "Sistema de Asistencia Escolar",
      version: "1.0",

      estudiantes: await prisma.estudiante.findMany(),
      turnos: await prisma.turno.findMany(),
      asistencias: await prisma.asistencia.findMany(),
      usuarios: await prisma.usuario.findMany({
        select: {
          id: true,
          usuario: true,
          rol: true,
          estado: true,
          createdAt: true,
        },
      }),
      configuracion: await prisma.configuracion.findMany(),
      auditoria: await prisma.auditoria.findMany(),
    };

    const json = JSON.stringify(data, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_asistencia_${fecha}.json"`,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Error al generar backup" },
      { status: 500 }
    );
  }
}