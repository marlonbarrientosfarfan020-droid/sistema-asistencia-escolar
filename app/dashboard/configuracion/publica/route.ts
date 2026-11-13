import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_POR_DEFECTO = "/img/logo-santa-rita.png";

function resolverLogoInstitucional(logoUrl?: string | null): string {
  const limpio = String(logoUrl || "").trim();
  if (!limpio) return LOGO_POR_DEFECTO;

  if (limpio.startsWith("/")) {
    const rutaFisica = path.join(process.cwd(), "public", limpio.replace(/^\/+/, ""));
    if (!fs.existsSync(rutaFisica)) {
      return LOGO_POR_DEFECTO;
    }
  }

  return limpio;
}

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
            logoUrl: LOGO_POR_DEFECTO,
          },
        });
    }

    return NextResponse.json(
      {
        nombreColegio:
          configuracion.nombreColegio,
        logoUrl: resolverLogoInstitucional(configuracion.logoUrl),
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