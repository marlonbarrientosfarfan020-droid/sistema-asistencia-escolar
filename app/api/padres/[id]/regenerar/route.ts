import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirAdminODirectivo } from "@/lib/auth";
import { generarCodigoFamiliar } from "@/lib/codigo-familiar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/padres/[id]/regenerar
export async function POST(
  request: Request,
  contexto: { params: Promise<{ id: string }> }
) {
  const acceso = await exigirAdminODirectivo();
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const { id } = await contexto.params;
  const familiarId = Number(id);

  if (!familiarId || isNaN(familiarId)) {
    return NextResponse.json(
      { ok: false, message: "ID de familia inválido" },
      { status: 400 }
    );
  }

  try {
    const familia = await prisma.codigoFamiliar.findUnique({
      where: { id: familiarId },
    });

    if (!familia) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado" },
        { status: 404 }
      );
    }

    const codigoAnterior = familia.codigo;
    let nuevoCodigo = "";
    let intentos = 0;

    while (!nuevoCodigo || intentos < 10) {
      intentos++;
      const candidato = generarCodigoFamiliar();
      const existe = await prisma.codigoFamiliar.findUnique({
        where: { codigo: candidato },
      });
      if (!existe) {
        nuevoCodigo = candidato;
        break;
      }
    }

    if (!nuevoCodigo) {
      return NextResponse.json(
        { ok: false, message: "No se pudo generar un nuevo código único" },
        { status: 500 }
      );
    }

    const familiaActualizada = await prisma.codigoFamiliar.update({
      where: { id: familiarId },
      data: { codigo: nuevoCodigo },
      include: {
        estudiantes: {
          where: { estado: true },
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
      },
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "REGENERAR_CODIGO_FAMILIAR",
      modulo: "PADRES",
      detalle: `Regenerado código familiar de ${codigoAnterior} a ${nuevoCodigo}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Nuevo código familiar generado con éxito",
      codigoAnterior,
      nuevoCodigo,
      familia: familiaActualizada,
    });
  } catch (error) {
    console.error("Error regenerando código familiar:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al regenerar código familiar" },
      { status: 500 }
    );
  }
}
