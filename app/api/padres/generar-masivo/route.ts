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
    const body = await request.json().catch(() => ({}));
    const agruparPorTutor = body.agruparPorTutor !== false;

    // Buscar estudiantes activos sin código familiar
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
        message: "No hay estudiantes pendientes de asignación de código familiar",
        familiasCreadas: 0,
        alumnasVinculadas: 0,
      });
    }

    // Agrupar estudiantes
    // Clave de agrupación: si agruparPorTutor es true, buscar si coinciden en tutor normalizado o whatsapp
    const grupos: Array<{
      tutor: string;
      telefono: string;
      estudianteIds: number[];
    }> = [];

    if (agruparPorTutor) {
      const mapaGrupos = new Map<string, { tutor: string; telefono: string; estudianteIds: number[] }>();

      for (const est of estudiantesSinCodigo) {
        const tutorNorm = (est.nombreTutor || "").trim().toLowerCase();
        const whatsappNorm = (est.whatsapp || "").replace(/\D/g, "");

        // Clave primaria: whatsapp si tiene al menos 8 digitos, o tutor si tiene al menos 5 letras
        let clave = "";
        if (whatsappNorm.length >= 8) {
          clave = `W:${whatsappNorm}`;
        } else if (tutorNorm.length >= 5) {
          clave = `T:${tutorNorm}`;
        } else {
          clave = `E:${est.id}`; // Grupo individual
        }

        if (mapaGrupos.has(clave)) {
          mapaGrupos.get(clave)!.estudianteIds.push(est.id);
        } else {
          mapaGrupos.set(clave, {
            tutor: est.nombreTutor || `Familia de ${est.nombres} ${est.apellidos}`,
            telefono: est.whatsapp || "",
            estudianteIds: [est.id],
          });
        }
      }

      grupos.push(...mapaGrupos.values());
    } else {
      // Uno por estudiante
      for (const est of estudiantesSinCodigo) {
        grupos.push({
          tutor: est.nombreTutor || `Familia de ${est.nombres} ${est.apellidos}`,
          telefono: est.whatsapp || "",
          estudianteIds: [est.id],
        });
      }
    }

    // Obtener códigos existentes para evitar colisiones
    const codigosExistentes = new Set(
      (await prisma.codigoFamiliar.findMany({ select: { codigo: true } })).map((c) => c.codigo)
    );

    let familiasCreadasCount = 0;
    let alumnasVinculadasCount = 0;

    // Procesar en lotes dentro de una transacción
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
      detalle: `Generación masiva completada: ${familiasCreadasCount} familias creadas y ${alumnasVinculadasCount} alumnas vinculadas`,
    });

    return NextResponse.json({
      ok: true,
      message: `Generación masiva completada: ${familiasCreadasCount} familias creadas y ${alumnasVinculadasCount} alumnas vinculadas`,
      familiasCreadas: familiasCreadasCount,
      alumnasVinculadas: alumnasVinculadasCount,
    });
  } catch (error) {
    console.error("Error en generación masiva de códigos familiares:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al ejecutar la generación masiva" },
      { status: 500 }
    );
  }
}
