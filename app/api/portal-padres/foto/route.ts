import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPadre } from "@/lib/auth-padres";
import { obtenerSesion } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal-padres/foto?asistenciaId=123&tipo=ENTRADA
 * Endpoint proxy seguro para entrega autorizada de evidencias fotogr�ficas.
 * Valida la identidad y relaci�n familiar en PostgreSQL antes de servir la imagen.
 */
export async function GET(request: Request) {
  const sesionPersonal = await obtenerSesion(request);
  const sesionPadre = sesionPersonal ? null : await obtenerSesionPadre(request);

  if (!sesionPersonal && !sesionPadre) {
    return NextResponse.json(
      { ok: false, message: "No autorizado. Debe iniciar sesión para visualizar la evidencia." },
      { status: 401 }
    );
  }

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
        fotoProtegida: true,
        fotoEntradaProtegida: true,
        fotoSalidaProtegida: true,
        colegioId: true,
        evidenciasFotograficas: {
          select: {
            tipo: true,
            esActiva: true,
            esProtegida: true,
          },
        },
      },
    });

    if (!asistencia) {
      return NextResponse.json(
        { ok: false, message: "Registro de asistencia no encontrado" },
        { status: 404 }
      );
    }

        // 2. VALIDACIÓN ESTRICTA EN POSTGRESQL
    if (sesionPersonal) {
      // Personal / Admin: debe pertenecer a la misma institución o ser SUPER_ADMIN
      const colegioPersonal = sesionPersonal.colegioId || "SANTA_RITA_001";
      if (sesionPersonal.rol !== "SUPER_ADMIN" && asistencia.colegioId !== colegioPersonal) {
        return NextResponse.json(
          { ok: false, message: "Acceso denegado: la asistencia no pertenece a su institución educativa." },
          { status: 403 }
        );
      }
    } else if (sesionPadre) {
      // Familia: debe pertenecer a los estudiantes autorizados y con relación vigente
      const estudianteAutorizado = sesionPadre.estudianteAutorizadoId;
      const permitidos = sesionPadre.estudiantesPermitidosIds || [estudianteAutorizado];

      if (!permitidos.includes(asistencia.estudianteId)) {
        console.warn(
          `[FOTO SEGURIDAD] Intento de acceso no autorizado a foto de asistencia #${asistenciaId} por familia ${sesionPadre.codigoFamiliar}`
        );
        return NextResponse.json(
          {
            ok: false,
            message: "Acceso denegado: no tiene autorización para visualizar la fotografía de esta asistencia.",
          },
          { status: 403 }
        );
      }

      // Comprobar que la relación familiar siga vigente en PostgreSQL
      const relacionVigente = await prisma.estudiante.findFirst({
        where: {
          id: asistencia.estudianteId,
          codigoFamiliarId: sesionPadre.codigoFamiliarId,
          estado: true,
        },
        select: { id: true },
      });

      if (!relacionVigente) {
        return NextResponse.json(
          { ok: false, message: "La autorización familiar para este estudiante ha sido revocada." },
          { status: 403 }
        );
      }
    }

    // 4. Verificar política de rotación y conservación institucional
    const evTipo = (asistencia as any).evidenciasFotograficas?.find((e: any) => e.tipo === tipo);
    const esProtegida = Boolean(
      asistencia.fotoProtegida ||
      (tipo === "SALIDA" ? asistencia.fotoSalidaProtegida : asistencia.fotoEntradaProtegida) ||
      evTipo?.esProtegida
    );
    const esActiva = evTipo ? evTipo.esActiva : true;

    if (!esActiva && !esProtegida) {
      return NextResponse.json(
        {
          ok: false,
          conservada: false,
          estado: "NO_CONSERVADA",
          message: "Fotografía no conservada según la política de rotación y almacenamiento institucional.",
        },
        { status: 410 }
      );
    }

    // Obtener la URL de la imagen
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
