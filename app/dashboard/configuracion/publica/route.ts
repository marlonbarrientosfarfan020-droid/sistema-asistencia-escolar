import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let configuracion =
      await prisma.configuracion.findFirst({
        orderBy: {
          id: "asc",
        },
      });

    if (!configuracion) {
      configuracion =
        await prisma.configuracion.create({
          data: {
            nombreColegio:
              "Santa Rita de Casia",
          },
        });
    }

    return NextResponse.json(
      {
        nombreColegio:
          configuracion.nombreColegio,
        logoUrl:
          configuracion.logoUrl || "",
        direccion:
          configuracion.direccion || "",
        telefono:
          configuracion.telefono || "",
        correo:
          configuracion.correo || "",
        director:
          configuracion.director || "",
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error obteniendo configuración pública:",
      error
    );

    return NextResponse.json(
      {
        message:
          "No se pudo cargar la configuración institucional",
      },
      {
        status: 500,
      }
    );
  }
}