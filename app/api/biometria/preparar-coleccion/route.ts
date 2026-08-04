import { NextResponse } from "next/server";
import { asegurarColeccionFacial } from "@/lib/aws-rekognition";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function prepararColeccion() {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const resultado =
      await asegurarColeccionFacial();

    return NextResponse.json({
      ok: true,
      message: resultado.creada
        ? "Colección facial creada correctamente"
        : "La colección facial ya existía",
      creada: resultado.creada,
      collectionId:
        resultado.collectionId,
    });
  } catch (error) {
    console.error(
      "Error preparando colección facial:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo preparar la colección facial",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST() {
  return prepararColeccion();
}

export async function GET() {
  return prepararColeccion();
}