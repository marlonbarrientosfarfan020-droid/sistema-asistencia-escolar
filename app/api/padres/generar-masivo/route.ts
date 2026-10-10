import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirAdminODirectivo } from "@/lib/auth";
import { generarCodigoFamiliar } from "@/lib/codigo-familiar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/padres/generar-masivo
export async function POST(request: Request) {
  const acceso = await exigirAdminODirectivo();
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    // Buscar estudiantes activos sin c�digo familiar
    const estudiantesSinCodigo = await prisma.estudiante.findMany({
      where: {
        estado: true,
        codigoFamiliarId: null,
      },
      select: {
        id: true,
        codigo: true,
        dni: true,
        nombres: true,
        apellidos: true,
        grado: true,
        seccion: true,
        nombreTutor: true,
        whatsapp: true,
      },
      orderBy: [{ grado: "asc" }, { seccion: "asc" }, { apellidos: "asc" }],
    });

    if (estudiantesSinCodigo.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay estudiantes pendientes de asignaci�n de c�digo familiar",
        familiasCreadas: 0,
        alumnasVinculadas: 0,
      });
    }

    // REGLA INSTITUCIONAL DE SEGURIDAD Y PRIVACIDAD ESTRICTA:
    // NUNCA agrupar autom�ticamente a estudiantes por tel�fono gen�rico o nombres compartidos.
    // Cada estudiante recibe su propio c�digo familiar �nico e individual.
    // La vinculaci�n de hermanas debe ser confirmada expl�citamente por el personal del colegio.
    const grupos = estudiantesSinCodigo.map((est) => ({
      tutor: est.nombreTutor || `Familia de ${est.nombres} ${est.apellidos}`,
      telefono: est.whatsapp || "",
      estudianteIds: [est.id],
    }));

    // Obtener c�digos existentes para evitar colisiones
    const codigosExistentes = new Set(
      (await prisma.codigoFamiliar.findMany({ select: { codigo: true } })).map((c) => c.codigo)
    );

    let familiasCreadasCount = 0;
    let alumnasVinculadasCount = 0;

    // Procesar en lotes dentro de una transacci�n
    await prisma.$transaction(async (tx) => {
      for (const grupo of grupos) {
        let nuevoCodigo = "";
        let intentos = 0;
        while (!nuevoCodigo || intentos < 15) {
          intentos++;
          const candidato = generarCodigoFamiliar();
          if (!codigosExistentes.has(candidato)) {
            nuevoCodigo = candidato;
            codigosExistentes.add(candidato);
            break;
          }
        }

        if (!nuevoCodigo) continue;

        const familia = await tx.codigoFamiliar.create({
          data: {
            codigo: nuevoCodigo,
            tutorTitular: grupo.tutor,
            telefonoContacto: grupo.telefono,
            estado: true,
          },
        });

        await tx.estudiante.updateMany({
          where: { id: { in: grupo.estudianteIds } },
          data: { codigoFamiliarId: familia.id },
        });

        familiasCreadasCount++;
        alumnasVinculadasCount += grupo.estudianteIds.length;
      }
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "GENERACION_MASIVA_CODIGOS_FAMILIARES",
      modulo: "PADRES",
      detalle: `Generaci�n masiva individualizada completada: ${familiasCreadasCount} c�digos creados para ${alumnasVinculadasCount} alumnas`,
    });

    return NextResponse.json({
      ok: true,
      message: `Generaci�n masiva individualizada completada: ${familiasCreadasCount} familias creadas y ${alumnasVinculadasCount} alumnas vinculadas`,
      familiasCreadas: familiasCreadasCount,
      alumnasVinculadas: alumnasVinculadasCount,
    });
  } catch (error) {
    console.error("Error en generaci�n masiva de c�digos familiares:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al ejecutar la generaci�n masiva" },
      { status: 500 }
    );
  }
}
