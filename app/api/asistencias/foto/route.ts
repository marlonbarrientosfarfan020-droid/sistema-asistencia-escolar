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
  console.log("[FOTO API] solicitud recibida");

  const acceso =
    await exigirAdminOPersonal(request);

  if (!acceso.autorizado) {
    console.warn("[FOTO API] Acceso denegado en /api/asistencias/foto");
    return acceso.respuesta;
  }

  try {
    const token =
      process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      "vercel_blob_rw_r9pOgVzx5STmwmFx_ystFFESySyRRNJJpGeQycdY6oVuwDB";

    if (!token) {
      console.error("[FOTO API] Falta BLOB_READ_WRITE_TOKEN");
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
      console.warn("[FOTO API] Campo 'foto' no es instancia de File");
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

    console.log(`[FOTO API] archivo recibido: ${archivo.size} bytes, tipo: ${archivo.type}`);

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

    // Convertimos el archivo a Buffer para evitar stream deadlocks en Serverless
    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[FOTO API] iniciando upload Blob:", nombreArchivo);

    const blob =
      await put(
        nombreArchivo,
        buffer,
        {
          access: "public",
          token,
          addRandomSuffix: false,
          contentType: archivo.type || "image/jpeg",
        }
      );

    console.log("[FOTO API] upload terminado");
    console.log("[FOTO API] URL generada:", blob.url);

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
      "[FOTO API] Error subiendo fotografía a Vercel Blob:",
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