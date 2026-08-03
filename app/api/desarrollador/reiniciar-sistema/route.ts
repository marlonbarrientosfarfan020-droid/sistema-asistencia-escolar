import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRASE_CONFIRMACION = "REINICIAR SISTEMA";

export async function POST(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const confirmacion = String(body.confirmacion || "").trim().toUpperCase();

    if (confirmacion !== FRASE_CONFIRMACION) {
      return NextResponse.json(
        {
          ok: false,
          message: `Para confirmar, escriba exactamente: ${FRASE_CONFIRMACION}`,
        },
        { status: 400 },
      );
    }

    const [
      estudiantesAntes,
      asistenciasAntes,
      alertasAntes,
      analisisAntes,
      riesgosAntes,
      reportesAntes,
      auditoriasAntes,
    ] = await Promise.all([
      prisma.estudiante.count(),
      prisma.asistencia.count(),
      prisma.alertaAsistencia.count(),
      prisma.analisisIA.count(),
      prisma.riesgoEstudianteIA.count(),
      prisma.historialReporteAutomatico.count(),
      prisma.auditoria.count(),
    ]);

    await prisma.$transaction(
      async (tx) => {
        await tx.historialReporteAutomatico.deleteMany();
        await tx.alertaAsistencia.deleteMany();
        await tx.asistencia.deleteMany();
        await tx.riesgoEstudianteIA.deleteMany();
        await tx.analisisIA.deleteMany();
        await tx.estudiante.deleteMany();
        await tx.auditoria.deleteMany();

        await tx.configuracion.updateMany({
          data: {
            automatizacionesActivas: false,
            modoPruebaAlertas: true,
            reporteTelegramActivo: false,
            reporteDirectorActivo: false,
            reportePadresActivo: false,
            ultimoReporteTelegramAt: null,
            ultimoReporteTelegramEstado: "",
            ultimoReporteDirectorAt: null,
            ultimoReportePadresAt: null,
            ultimaEjecucionAutomatizaciones: null,
            ultimaEjecucionEstado: "",
          },
        });

        await tx.auditoria.create({
          data: {
            usuario: acceso.sesion.usuario,
            rol: acceso.sesion.rol,
            accion: "REINICIO_TOTAL",
            modulo: "MODO_DESARROLLADOR",
            detalle:
              "Se eliminaron todos los datos operativos de prueba. " +
              "Se conservaron usuarios, configuración institucional, turnos y calendario escolar.",
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 60000,
      },
    );

    const [
      estudiantesActuales,
      asistenciasActuales,
      alertasActuales,
      analisisActuales,
      riesgosActuales,
      reportesActuales,
    ] = await Promise.all([
      prisma.estudiante.count(),
      prisma.asistencia.count(),
      prisma.alertaAsistencia.count(),
      prisma.analisisIA.count(),
      prisma.riesgoEstudianteIA.count(),
      prisma.historialReporteAutomatico.count(),
    ]);

    return NextResponse.json({
      ok: true,
      message:
        "Sistema reiniciado correctamente. Ya puede importar a los estudiantes reales.",
      eliminados: {
        estudiantes: estudiantesAntes,
        asistencias: asistenciasAntes,
        alertas: alertasAntes,
        analisisIA: analisisAntes,
        riesgosIA: riesgosAntes,
        reportesAutomaticos: reportesAntes,
        auditoriasPrueba: auditoriasAntes,
      },
      estadoActual: {
        estudiantes: estudiantesActuales,
        asistencias: asistenciasActuales,
        alertas: alertasActuales,
        analisisIA: analisisActuales,
        riesgosIA: riesgosActuales,
        reportesAutomaticos: reportesActuales,
      },
    });
  } catch (error) {
    console.error("Error reiniciando el sistema:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo reiniciar el sistema",
      },
      { status: 500 },
    );
  }
}