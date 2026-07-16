import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarWhatsApp } from "@/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const configuracion = await prisma.configuracion.findFirst();

    const telefono =
      configuracion?.telefono?.replace(/\D/g, "") || "";

    if (!telefono) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Debe configurar primero el teléfono en Configuración.",
        },
        {
          status: 400,
        }
      );
    }

    await enviarWhatsApp({
      telefono,
      tutor: acceso.sesion.usuario,
      estudiante: "Prueba Sistema Asistencia",
      tipo: "ENTRADA",
      hora: new Date().toLocaleTimeString("es-PE"),
      grado: "5",
      seccion: "A",
      turno: "TARDE",
      estado: "PUNTUAL",
      metodo: "PRUEBA",
    });

    return NextResponse.json({
      ok: true,
      message: "Mensaje enviado correctamente.",
    });
  } catch (error) {
    console.error("Error enviando WhatsApp:", error);

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