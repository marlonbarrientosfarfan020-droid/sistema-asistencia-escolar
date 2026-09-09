import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const acceso = await exigirAdmin(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const fecha = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const [
      estudiantes,
      turnos,
      asistencias,
      usuarios,
      configuracion,
      auditoria,
      alertasAsistencia,
      analisisIA,
      riesgosIA,
      calendarioEscolar,
      historialReportes,
      colegios,
      codigosFamiliares,
      sistemasControl,
      biometriasFaciales,
      rostrosFaciales,
      systemHealthLogs,
    ] = await Promise.all([
      prisma.estudiante.findMany({ orderBy: { id: "asc" } }),
      prisma.turno.findMany({ orderBy: { id: "asc" } }),
      prisma.asistencia.findMany({ orderBy: { id: "asc" } }),

      prisma.usuario.findMany({
        select: {
          id: true,
          colegioId: true,
          usuario: true,
          rol: true,
          estado: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      }),

      prisma.configuracion.findMany({ orderBy: { id: "asc" } }),
      prisma.auditoria.findMany({ orderBy: { id: "asc" } }),
      prisma.alertaAsistencia.findMany({ orderBy: { id: "asc" } }),
      prisma.analisisIA.findMany({ orderBy: { id: "asc" } }),
      prisma.riesgoEstudianteIA.findMany({ orderBy: { id: "asc" } }),
      prisma.calendarioEscolar.findMany({ orderBy: { id: "asc" } }),
      prisma.historialReporteAutomatico.findMany({ orderBy: { id: "asc" } }),
      prisma.colegio.findMany({ orderBy: { id: "asc" } }),
      prisma.codigoFamiliar.findMany({ orderBy: { id: "asc" } }),
      prisma.sistemaControl.findMany({ orderBy: { id: "asc" } }),
      prisma.biometriaFacial.findMany({ orderBy: { id: "asc" } }),
      prisma.rostroFacial.findMany({ orderBy: { id: "asc" } }),
      prisma.systemHealthLog.findMany({ orderBy: { id: "asc" } }),
    ]);

    const data = {
      generadoEn: new Date().toISOString(),
      generadoPor: {
        usuario: acceso.sesion.usuario,
        rol: acceso.sesion.rol,
      },
      sistema: "Sistema de Asistencia Escolar",
      version: "1.1",

      // Tablas principales existentes
      estudiantes,
      turnos,
      asistencias,
      usuarios,
      configuracion,
      auditoria,
      alertasAsistencia,
      analisisIA,
      riesgosIA,
      calendarioEscolar,
      historialReportes,

      // Entidades críticas incorporadas para respaldo y recuperación completa
      colegios,
      codigosFamiliares,
      sistemaControl: sistemasControl,
      biometriaFacial: biometriasFaciales,
      rostroFacial: rostrosFaciales,
      systemHealthLogs,

      // Nombres de modelos solicitados
      Colegio: colegios,
      CodigoFamiliar: codigosFamiliares,
      SistemaControl: sistemasControl,
      BiometriaFacial: biometriasFaciales,
      RostroFacial: rostrosFaciales,
      SystemHealthLog: systemHealthLogs,
    };

    const json = JSON.stringify(data, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="backup_asistencia_${fecha}.json"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error(
      "Error generando backup:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Error al generar backup",
      },
      {
        status: 500,
      }
    );
  }
}