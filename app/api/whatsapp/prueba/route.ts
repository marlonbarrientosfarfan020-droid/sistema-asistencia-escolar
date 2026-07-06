import { NextResponse } from "next/server";
import { enviarWhatsApp } from "@/services/whatsapp";

export async function GET() {
  try {
    await enviarWhatsApp({
      telefono: "51933701278", // TU NUMERO
      tutor: "Marlon",
      estudiante: "Prueba Sistema Asistencia",
      tipo: "ENTRADA",
      hora: new Date().toLocaleTimeString("es-PE"),
      grado: "5",
      seccion: "A",
      turno: "TARDE (16:22 - 18:00)",
      estado: "PUNTUAL",
      metodo: "PRUEBA",
    });

    return NextResponse.json({
      ok: true,
      message: "Mensaje enviado correctamente.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo enviar el mensaje.",
      },
      { status: 500 }
    );
  }
}