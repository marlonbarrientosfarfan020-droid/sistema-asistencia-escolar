import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminOPersonal } from "@/lib/auth";
import { resolverColegio } from "@/lib/tenant";
import { fechaPeru } from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FASE 4.2.1 - PANEL ADMINISTRATIVO DE EVIDENCIAS FOTOGRÁFICAS
 * Consulta auditoría y trazabilidad de fotografías: completadas, pendientes y errores.
 */
export async function GET(request: Request) {
  const acceso = await exigirAdminOPersonal(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  const colegioId = tenant.ok ? tenant.context.colegioId : "SANTA_RITA_001";

  const { searchParams } = new URL(request.url);
  const estadoFiltro = searchParams.get("estado"); // PENDIENTE | SUBIENDO | COMPLETADA | ERROR | ERROR_FINAL
  const fechaFiltro = searchParams.get("fecha"); // YYYY-MM-DD opcional

  try {
    // 1. Métricas agregadas de control
    const [completadas, pendientes, subiendo, errores, erroresFinales] = await Promise.all([
      prisma.evidenciaFotografica.count({
        where: { colegioId, estado: "COMPLETADA" },
      }),
      prisma.evidenciaFotografica.count({
        where: { colegioId, estado: "PENDIENTE" },
      }),
      prisma.evidenciaFotografica.count({
        where: { colegioId, estado: "SUBIENDO" },
      }),
      prisma.evidenciaFotografica.count({
        where: { colegioId, estado: "ERROR" },
      }),
      prisma.evidenciaFotografica.count({
        where: { colegioId, estado: "ERROR_FINAL" },
      }),
    ]);

    // 2. Consulta de registros con trazabilidad
    const whereClause: any = {
      colegioId,
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
      ...(fechaFiltro
        ? {
            asistencia: {
              fechaDia: fechaFiltro,
            },
          }
        : {}),
    };

    const evidencias = await prisma.evidenciaFotografica.findMany({
      where: whereClause,
      include: {
        estudiante: {
          select: {
            id: true,
            codigo: true,
            dni: true,
            nombres: true,
            apellidos: true,
            grado: true,
            seccion: true,
          },
        },
        asistencia: {
          select: {
            id: true,
            fechaDia: true,
            horaEntrada: true,
            horaSalida: true,
            estado: true,
          },
        },
      },
      orderBy: { id: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      resumen: {
        total: completadas + pendientes + subiendo + errores + erroresFinales,
        completadas,
        pendientes,
        subiendo,
        errores,
        erroresFinales,
        erroresTotales: errores + erroresFinales,
      },
      evidencias: evidencias.map((ev) => ({
        id: ev.id,
        asistenciaId: ev.asistenciaId,
        tipo: ev.tipo,
        estado: ev.estado,
        url: ev.url,
        intentos: ev.intentos,
        ultimoIntento: ev.ultimoIntento,
        errorDetalle: ev.errorDetalle,
        createdAt: ev.createdAt,
        estudiante: {
          id: ev.estudiante.id,
          codigo: ev.estudiante.codigo,
          dni: ev.estudiante.dni,
          nombres: ev.estudiante.nombres,
          apellidos: ev.estudiante.apellidos,
          grado: ev.estudiante.grado,
          seccion: ev.estudiante.seccion,
        },
        asistencia: {
          id: ev.asistencia.id,
          fechaDia: ev.asistencia.fechaDia,
          horaEntrada: ev.asistencia.horaEntrada,
          horaSalida: ev.asistencia.horaSalida,
        },
      })),
    });
  } catch (error: any) {
    console.error("[EVIDENCIAS API] Error consultando auditoría de fotos:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Error consultando auditoría de evidencias",
      },
      { status: 500 }
    );
  }
}
