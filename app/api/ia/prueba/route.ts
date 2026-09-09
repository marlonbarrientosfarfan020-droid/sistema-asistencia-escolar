import { NextResponse } from "next/server";
import { generarAnalisisIA } from "@/services/groqService";
import { exigirAdmin } from "@/lib/auth";
import { verificarModuloActivo } from "@/lib/supermotor-guard";
import { resolverColegio } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acceso = await exigirAdmin(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }
  const colegioId = tenant.context.colegioId;

  const validacionIA = await verificarModuloActivo("ia", colegioId);
  if (!validacionIA.autorizado) {
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: "Módulo IA desactivado",
      },
      { status: 403 }
    );
  }

  try {
    const respuesta = await generarAnalisisIA(
      "Redacta una alerta breve y profesional para un padre indicando que su hijo registra tardanzas frecuentes."
    );

    return NextResponse.json({
      ok: true,
      respuesta,
    });
  } catch (error: unknown) {
    console.error("Error probando conexión con IA:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error con Groq",
      },
      {
        status: 500,
      }
    );
  }
}