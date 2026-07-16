import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDirectivoODemo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const acceso = await exigirAdminDirectivoODemo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const ranking = await prisma.riesgoEstudianteIA.findMany({
      orderBy: {
        porcentaje: "desc",
      },
      take: 10,
      include: {
        estudiante: {
          include: {
            turno: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      ranking,
    });
  } catch (error: unknown) {
    console.error(
      "Error obteniendo ranking de riesgo:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al obtener ranking de riesgo",
      },
      {
        status: 500,
      }
    );
  }
}