type DatosWhatsApp = {
  telefono: string;
  tutor: string;
  estudiante: string;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
  grado?: string;
  seccion?: string;
  turno?: string;
  estado?: string;
  metodo?: string;
};

export async function enviarWhatsApp({
  telefono,
  tutor,
  estudiante,
  tipo,
  hora,
  grado,
  seccion,
  turno,
  estado,
  metodo,
}: DatosWhatsApp) {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log("WhatsApp desactivado");
    return false;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("Falta configurar WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID");
    return false;
  }

  if (!telefono) {
    console.warn("El estudiante no tiene WhatsApp registrado");
    return false;
  }

  const iconoEstado = estado === "TARDE" ? "🟠" : "🟢";

  const mensaje = `🏫 I.E. Santa Rita de Casia

Hola ${tutor || "tutor"}.

${tipo === "ENTRADA" ? "✅ ENTRADA REGISTRADA" : "👋 SALIDA REGISTRADA"}

👨‍🎓 Estudiante:
${estudiante}

📚 Grado:
${grado || "-"} - ${seccion || "-"}

⏰ Turno:
${turno || "Sin turno"}

${iconoEstado} Estado:
${estado || "-"}

🕒 Hora:
${hora}

📌 Método:
${metodo || "Sistema de Asistencia"}`;

  try {
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

    if (!response.ok) {
      console.error("❌ Error enviando WhatsApp:", data);
      return false;
    }

    console.log("✅ WhatsApp enviado correctamente:", data);
    return true;
  } catch (error) {
    console.error("❌ Error inesperado enviando WhatsApp:", error);
    return false;
  }
}