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
    await exigirAdminOPersonal(request);

  if (!acceso.autorizado) {
    console.warn("[BLOB API] Acceso denegado en /api/asistencias/foto");
    return acceso.respuesta;
  }

  try {
    console.log("[BLOB API] Petición autorizada en /api/asistencias/foto");
    const token =
      process.env.BLOB_READ_WRITE_TOKEN?.trim();

    if (!token) {
      console.error("[BLOB API] Falta BLOB_READ_WRITE_TOKEN");
      return NextResponse.json(
        {
          ok: false,
          message:
            "Falta BLOB_READ_WRITE_TOKEN en las variables de entorno",
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
      console.warn("[BLOB API] Campo 'foto' no es instancia de File");
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

    console.log("[BLOB API] Archivo recibido:", {
      name: archivo.name,
      size: archivo.size,
      type: archivo.type,
    });

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

    console.log("[BLOB API] Enviando a Vercel Blob:", nombreArchivo);

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

    console.log("[BLOB API] Subida exitosa a Vercel Blob. URL:", blob.url);

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
      "[BLOB API] Error subiendo fotografía a Vercel Blob:",
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