type DatosWhatsApp = {
  telefono: string;
  tutor: string;
  estudiante: string;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
};

export async function enviarWhatsApp({
  telefono,
  tutor,
  estudiante,
  tipo,
  hora,
}: DatosWhatsApp) {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log("WhatsApp desactivado");
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("Falta configurar WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  console.log("Enviando WhatsApp a:", telefono);

  const mensaje =
    tipo === "ENTRADA"
      ? `🏫 Asistencia Escolar

Hola ${tutor}.

Le informamos que ${estudiante} registró su ENTRADA al colegio a las ${hora}.`
      : `🏫 Asistencia Escolar

Hola ${tutor}.

Le informamos que ${estudiante} registró su SALIDA del colegio a las ${hora}.`;

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: {
          body: mensaje,
        },
      }),
    }
  );

  const data = await response.json();

  console.log("Respuesta WhatsApp:", data);

  if (!response.ok) {
    console.error("Error enviando WhatsApp:", data);
  } else {
    console.log("✅ WhatsApp enviado correctamente");
  }

  return data;
}