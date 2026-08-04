import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { exigirAdminOPersonal } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const TAMANO_MAXIMO = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const acceso =
    await exigirAdminOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const token =
      process.env.BLOB_READ_WRITE_TOKEN?.trim();

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Falta BLOB_READ_WRITE_TOKEN en el archivo .env local",
        },
        {
          status: 500,
        }
      );
    }

    const formData =
      await request.formData();

    const archivo =
      formData.get("foto");

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No se recibió la fotografía",
        },
        {
          status: 400,
        }
      );
    }

    if (archivo.size <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La fotografía está vacía",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !TIPOS_PERMITIDOS.includes(
        archivo.type
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `Formato no permitido: ${archivo.type || "desconocido"}`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      archivo.size >
      TAMANO_MAXIMO
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La fotografía supera los 5 MB",
        },
        {
          status: 400,
        }
      );
    }

    const extension =
      archivo.type === "image/png"
        ? "png"
        : archivo.type === "image/webp"
          ? "webp"
          : "jpg";

    const nombreArchivo =
      `asistencias/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const blob =
      await put(
        nombreArchivo,
        archivo,
        {
          access: "public",
          token,
          addRandomSuffix: false,
          contentType: archivo.type,
        }
      );

    return NextResponse.json({
      ok: true,
      message:
        "Fotografía almacenada correctamente",
      fotoUrl: blob.url,
      downloadUrl:
        blob.downloadUrl,
      pathname:
        blob.pathname,
      contentType:
        blob.contentType,
      size:
        archivo.size,
    });
  } catch (error: unknown) {
    console.error(
      "Error subiendo fotografía a Vercel Blob:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error desconocido al almacenar la fotografía";

    return NextResponse.json(
      {
        ok: false,
        message:
          `No se pudo almacenar la fotografía: ${mensaje}`,
      },
      {
        status: 500,
      }
    );
  }
}