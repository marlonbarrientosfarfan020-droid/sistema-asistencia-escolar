import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const configuracion = await prisma.configuracion.findFirst({
      select: {
        nombreColegio: true,
        logoUrl: true,
        direccion: true,
        telefono: true,
        correo: true,
        director: true,
        canalPortalWebActivo: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        nombreColegio:
          configuracion?.nombreColegio?.trim() ||
          "Institución educativa",

        logoUrl: resolverLogoInstitucional(configuracion?.logoUrl),

        direccion:
          configuracion?.direccion?.trim() || "",

        telefono:
          configuracion?.telefono?.trim() || "",

        correo:
          configuracion?.correo?.trim() || "",

        director:
          configuracion?.director?.trim() || "",

        canalPortalWebActivo:
          Boolean(configuracion?.canalPortalWebActivo),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error cargando configuración pública:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo cargar la configuración institucional",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}