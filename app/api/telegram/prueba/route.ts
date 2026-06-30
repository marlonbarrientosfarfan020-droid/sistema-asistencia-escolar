import { NextResponse } from "next/server";
import { enviarTelegram } from "@/lib/telegram";

export async function GET() {
  try {
    await enviarTelegram(
      "7530504168", // Tu chat_id
      `🏫 I.E. Santa Rita de Casia

✅ Conexión exitosa

El sistema de asistencia se conectó correctamente con Telegram.

📅 Fecha: ${new Date().toLocaleDateString("es-PE")}
🕒 Hora: ${new Date().toLocaleTimeString("es-PE")}

👨‍💻 Desarrollado por
Marlon Barrientos Farfán`
    );

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