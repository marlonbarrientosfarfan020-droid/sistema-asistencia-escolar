import axios from "axios";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function enviarTelegram(chatId: string, mensaje: string) {
  if (!TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN no configurado.");
    return false;
  }

  if (!chatId) {
    console.warn("⚠️ El tutor no tiene Chat ID registrado.");
    return false;
  }

  try {
    const respuesta = await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: mensaje,
        parse_mode: "HTML",
      }
    );

    console.log("✅ Telegram enviado correctamente.");
    return true;
  } catch (error: any) {
    console.error(
      "❌ Error Telegram:",
      error.response?.data || error.message
    );
    return false;
  }
}
import FormData from "form-data";

export async function enviarArchivoTelegram(
  chatId: string,
  archivo: Buffer,
  nombreArchivo: string,
  caption: string
) {
  if (!TOKEN || !chatId) return false;

  const formData = new FormData();

  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append("document", archivo, {
    filename: nombreArchivo,
  });

  await axios.post(
    `https://api.telegram.org/bot${TOKEN}/sendDocument`,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  return true;
}