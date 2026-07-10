import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
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
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Error al obtener historial IA",
      },
      { status: 500 }
    );
  }
}