import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const acceso = await exigirAdmin();

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
    ] = await Promise.all([
      prisma.estudiante.findMany(),
      prisma.turno.findMany(),
      prisma.asistencia.findMany(),

      prisma.usuario.findMany({
        select: {
          id: true,
          usuario: true,
          rol: true,
          estado: true,
          createdAt: true,
        },
      }),

      prisma.configuracion.findMany(),
      prisma.auditoria.findMany(),
      prisma.alertaAsistencia.findMany(),
      prisma.analisisIA.findMany(),
      prisma.riesgoEstudianteIA.findMany(),
      prisma.calendarioEscolar.findMany(),
      prisma.historialReporteAutomatico.findMany(),
    ]);

    const data = {
      generadoEn: new Date().toISOString(),
      generadoPor: {
        usuario: acceso.sesion.usuario,
        rol: acceso.sesion.rol,
      },
      sistema: "Sistema de Asistencia Escolar",
      version: "1.0",

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