import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      },
    });

    return NextResponse.json(
      {
        ok: true,
        nombreColegio:
          configuracion?.nombreColegio?.trim() ||
          "Institución educativa",

        logoUrl:
          configuracion?.logoUrl?.trim() || "",

        direccion:
          configuracion?.direccion?.trim() || "",

        telefono:
          configuracion?.telefono?.trim() || "",

        correo:
          configuracion?.correo?.trim() || "",

        director:
          configuracion?.director?.trim() || "",
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