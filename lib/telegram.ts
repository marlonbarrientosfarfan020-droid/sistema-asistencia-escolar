import axios from "axios";
import FormData from "form-data";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function validarTelegram(chatId: string) {
  if (!TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN no configurado.");
    return false;
  }

  if (!chatId) {
    console.warn("⚠️ El tutor no tiene Chat ID registrado.");
    return false;
  }

  return true;
}

export async function enviarTelegram(chatId: string, mensaje: string) {
  if (!validarTelegram(chatId)) return false;

  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: mensaje,
      parse_mode: "HTML",
    });

    console.log("✅ Telegram enviado correctamente.");
    return true;
  } catch (error: any) {
    console.error("❌ Error Telegram:", error.response?.data || error.message);
    return false;
  }
}

export async function enviarArchivoTelegram(
  chatId: string,
  archivo: Buffer,
  nombreArchivo: string,
  caption: string
) {
  if (!validarTelegram(chatId)) return false;

  try {
    const formData = new FormData();

    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("document", archivo, {
      filename: nombreArchivo,
      contentType: "application/octet-stream",
    });

    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendDocument`,
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    console.log("✅ Archivo enviado por Telegram.");
    return true;
  } catch (error: any) {
    console.error(
      "❌ Error enviando archivo Telegram:",
      error.response?.data || error.message
    );
    return false;
  }
}

export async function enviarFotoTelegram(
  chatId: string,
  foto: Buffer,
  caption: string
) {
  if (!validarTelegram(chatId)) return false;

  try {
    const formData = new FormData();

    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("photo", foto, {
      filename: "asistencia.jpg",
      contentType: "image/jpeg",
    });

    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    console.log("✅ Foto enviada por Telegram.");
    return true;
  } catch (error: any) {
    console.error(
      "❌ Error enviando foto Telegram:",
      error.response?.data || error.message
    );
    return false;
  }
}