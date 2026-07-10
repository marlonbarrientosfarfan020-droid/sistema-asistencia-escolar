import { NextResponse } from "next/server";
import { generarAnalisisIA } from "@/services/groqService";

export async function GET() {
  try {
    const respuesta = await generarAnalisisIA(
      "Redacta una alerta breve y profesional para un padre indicando que su hijo registra tardanzas frecuentes."
    );

    return NextResponse.json({
      ok: true,
      respuesta,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Error con Groq",
      },
      { status: 500 }
    );
  }
}