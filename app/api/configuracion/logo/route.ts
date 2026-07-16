import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const TAMANO_MAXIMO = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const formData = await request.formData();
    const archivo = formData.get("logo");

    if (!(archivo instanceof File)) {
      
      return NextResponse.json(
        {
          ok: false,
          message: "Debe seleccionar una imagen",
        },
        { status: 400 }
      );
    }

   if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
  return NextResponse.json(
    {
      ok: false,
      message: "Solo se permiten imágenes PNG, JPG o WEBP",
    },
    { status: 400 }
  );
}

if (archivo.size <= 0) {
  return NextResponse.json(
    {
      ok: false,
      message: "La imagen seleccionada está vacía",
    },
    { status: 400 }
  );
}

if (archivo.size > TAMANO_MAXIMO) {
  return NextResponse.json(
    {
      ok: false,
      message: "La imagen no puede superar los 2 MB",
    },
    { status: 400 }
  );
}

    const extensiones: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };

    const extension = extensiones[archivo.type] || "png";

    const nombreArchivo =
      `configuracion/logo-colegio-${Date.now()}-` +
      `${crypto.randomUUID()}.${extension}`;

    const blob = await put(nombreArchivo, archivo, {
      access: "public",
      addRandomSuffix: false,
    });

    const logoUrl = blob.url;

    const configuracionActual =
      await prisma.configuracion.findFirst();

    const configuracion = configuracionActual
      ? await prisma.configuracion.update({
          where: {
            id: configuracionActual.id,
          },
          data: {
            logoUrl,
          },
        })
      : await prisma.configuracion.create({
          data: {
            nombreColegio: "Santa Rita de Casia",
            logoUrl,
          },
        });

    return NextResponse.json({
      ok: true,
      message: "Logo institucional actualizado correctamente",
      logoUrl: configuracion.logoUrl,
    });
  } catch (error) {
    console.error("Error actualizando logo:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno al actualizar el logo",
      },
      { status: 500 }
    );
  }
}