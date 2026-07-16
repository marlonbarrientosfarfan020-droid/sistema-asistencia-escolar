import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { exigirAdminOPersonal } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const TAMANO_MAXIMO = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const acceso = await exigirAdminOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const formData = await request.formData();
    const archivo = formData.get("foto");

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "No se recibió la fotografía",
        },
        { status: 400 }
      );
    }

    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Formato de imagen no permitido",
        },
        { status: 400 }
      );
    }

    if (archivo.size <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "La fotografía está vacía",
        },
        { status: 400 }
      );
    }

    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json(
        {
          ok: false,
          message: "La fotografía supera los 2 MB",
        },
        { status: 400 }
      );
    }

    const extension =
      archivo.type === "image/png"
        ? "png"
        : archivo.type === "image/webp"
          ? "webp"
          : "jpg";

    const nombre =
      `asistencias/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const blob = await put(nombre, archivo, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      ok: true,
      fotoUrl: blob.url,
    });
  } catch (error) {
    console.error("Error subiendo fotografía:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo almacenar la fotografía",
      },
      { status: 500 }
    );
  }
}