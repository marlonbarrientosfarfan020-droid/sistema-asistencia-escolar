import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const auditoria = await prisma.auditoria.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json(auditoria);
  } catch (error) {
    console.error("Error obteniendo auditoría:", error);

    return NextResponse.json(
      {
        message: "Error al obtener la auditoría",
      },
      {
        status: 500,
      }
    );
  }
}