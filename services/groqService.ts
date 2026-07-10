import Groq from "groq-sdk";

export async function generarAnalisisIA(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY no configurada");
  }

  const groq = new Groq({ apiKey });

  const respuesta = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content:
          "Eres un asistente experto en asistencia escolar. Redactas alertas profesionales, humanas y claras para padres, tutores y directivos.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.4,
  });

  return respuesta.choices[0]?.message?.content || "No se pudo generar análisis.";
}