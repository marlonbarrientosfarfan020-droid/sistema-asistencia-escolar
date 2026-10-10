import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSesionPadre } from "@/lib/auth-padres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal-padres/foto?asistenciaId=123&tipo=ENTRADA
 * Endpoint proxy seguro para entrega autorizada de evidencias fotogr�ficas.
 * Valida la identidad y relaci�n familiar en PostgreSQL antes de servir la imagen.
 */
export async function GET(request: Request) {
  const acceso = await exigirSesionPadre(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const { sesion } = acceso;

  try {
    const { searchParams } = new URL(request.url);
    const asistenciaIdRaw = searchParams.get("asistenciaId");
    const tipo = (searchParams.get("tipo") || "ENTRADA").toUpperCase();

    const asistenciaId = Number(asistenciaIdRaw);
    if (!asistenciaId || !Number.isInteger(asistenciaId) || asistenciaId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Par�metro asistenciaId inv�lido" },
        { status: 400 }
      );
    }

    // 1. Consultar asistencia en PostgreSQL
    const asistencia = await prisma.asistencia.findUnique({
      where: { id: asistenciaId },
      select: {
        id: true,
        estudianteId: true,
        fotoEntrada: true,
        fotoSalida: true,
        fotoUrl: true,
        colegioId: true,
      },
    });

    if (!asistencia) {
      return NextResponse.json(
        { ok: false, message: "Registro de asistencia no encontrado" },
        { status: 404 }
      );
    }

    // 2. VALIDACI�N ESTRICTA EN POSTGRESQL: La asistencia debe pertenecer al estudiante autorizado
    const estudianteAutorizado = sesion.estudianteAutorizadoId;
    const permitidos = sesion.estudiantesPermitidosIds || [estudianteAutorizado];

    if (!permitidos.includes(asistencia.estudianteId)) {
      console.warn(
        `[FOTO SEGURIDAD] Intento de acceso no autorizado a foto de asistencia #${asistenciaId} (estudianteId=${asistencia.estudianteId}) por familia ${sesion.codigoFamiliar}`
      );
      return NextResponse.json(
        {
          ok: false,
          message: "Acceso denegado: no tiene autorizaci�n para visualizar la fotograf�a de esta asistencia.",
        },
        { status: 403 }
      );
    }

    // 3. Comprobar que la relaci�n familiar siga vigente en PostgreSQL (revocaci�n en tiempo real)
    const relacionVigente = await prisma.estudiante.findFirst({
      where: {
        id: asistencia.estudianteId,
        codigoFamiliarId: sesion.codigoFamiliarId,
        estado: true,
      },
      select: { id: true },
    });

    if (!relacionVigente) {
      return NextResponse.json(
        { ok: false, message: "La autorizaci�n familiar para este estudiante ha sido revocada." },
        { status: 403 }
      );
    }

    // 4. Obtener la URL de la imagen
    const urlFoto =
      tipo === "SALIDA"
        ? asistencia.fotoSalida
        : (asistencia.fotoEntrada || asistencia.fotoUrl);

    if (!urlFoto) {
      return NextResponse.json(
        { ok: false, message: "No existe evidencia fotogr�fica registrada para esta marcaci�n" },
        { status: 404 }
      );
    }

    // 5. Servir la imagen mediante proxy seguro sin exponer la URL p�blica en el cliente
    try {
      const imgRes = await fetch(urlFoto, { cache: "no-store" });
      if (!imgRes.ok) {
        return NextResponse.json(
          { ok: false, message: "La imagen de evidencia no pudo ser recuperada del almacenamiento" },
          { status: 502 }
        );
      }

      const buffer = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    } catch (fetchErr) {
      console.error("[FOTO PROXY] Error al recuperar imagen externa:", fetchErr);
      return NextResponse.json(
        { ok: false, message: "Error al recuperar la fotograf�a de evidencia" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error en proxy de foto segura:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al procesar solicitud de fotograf�a" },
      { status: 500 }
    );
  }
}
