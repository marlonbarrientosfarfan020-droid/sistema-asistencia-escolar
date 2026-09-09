import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDirectivoODemo } from "@/lib/auth";
import { verificarModuloActivo } from "@/lib/supermotor-guard";
import { resolverColegio } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acceso = await exigirAdminDirectivoODemo(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }
  const colegioId = tenant.context.colegioId;

  const validacionIA = await verificarModuloActivo("ia", colegioId);
  if (!validacionIA.autorizado) {
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: "Módulo IA desactivado",
      },
      { status: 403 }
    );
  }

  try {
    const historial = await prisma.analisisIA.findMany({
      where: {
        colegioId,
      },
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