import { NextResponse } from "next/server";
import { generarAnalisisIA } from "@/services/groqService";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const respuesta = await generarAnalisisIA(
      "Redacta una alerta breve y profesional para un padre indicando que su hijo registra tardanzas frecuentes."
    );

    return NextResponse.json({
      ok: true,
      respuesta,
    });
  } catch (error: unknown) {
    console.error("Error probando conexión con IA:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error con Groq",
      },
      {
        status: 500,
      }
    );
  }
}