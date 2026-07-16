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
    const historial = await prisma.analisisIA.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      historial,
    });
  } catch (error: unknown) {
    console.error(
      "Error obteniendo historial IA:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al obtener historial IA",
      },
      {
        status: 500,
      }
    );
  }
}