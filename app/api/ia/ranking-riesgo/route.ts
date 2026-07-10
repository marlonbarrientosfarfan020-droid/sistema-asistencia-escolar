import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
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
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Error al obtener ranking de riesgo",
      },
      { status: 500 }
    );
  }
}