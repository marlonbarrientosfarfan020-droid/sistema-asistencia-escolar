import axios from "axios";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function enviarTelegram(chatId: string, mensaje: string) {
  if (!TOKEN || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: mensaje,
    });
  } catch (error) {
    console.error("Error enviando Telegram:", error);
  }
}