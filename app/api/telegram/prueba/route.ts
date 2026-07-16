import { NextResponse } from "next/server";
import { enviarTelegram } from "@/lib/telegram";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    await enviarTelegram(
      "7530504168",
      `🏫 I.E. Santa Rita de Casia

✅ Conexión exitosa

El sistema de asistencia se conectó correctamente con Telegram.

👤 Usuario:
${acceso.sesion.usuario}

📅 Fecha:
${new Date().toLocaleDateString("es-PE")}

🕒 Hora:
${new Date().toLocaleTimeString("es-PE")}

👨‍💻 Desarrollado por
Marlon Barrientos Farfán`
    );

    return NextResponse.json({
      ok: true,
      message: "Mensaje enviado correctamente.",
    });
  } catch (error) {
    console.error("Error enviando Telegram:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo enviar el mensaje.",
      },
      {
        status: 500,
      }
    );
  }
}