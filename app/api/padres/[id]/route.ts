import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  exigirAdminODirectivo,
  exigirAdminDirectivoDemoOPersonal,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function texto(valor: unknown): string {
  return String(valor || "").trim();
}

// GET /api/padres/[id]
export async function GET(
  request: Request,
  contexto: { params: Promise<{ id: string }> }
) {
  const acceso = await exigirAdminDirectivoDemoOPersonal();
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
            nombreTutor: true,
            whatsapp: true,
            estado: true,
          },
        },
      },
    });

    if (!familia) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, familia });
  } catch (error) {
    console.error("Error obteniendo familia:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al obtener familia" },
      { status: 500 }
    );
  }
}

// PUT /api/padres/[id]
export async function PUT(
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
    const body = await request.json();
    const familiaActual = await prisma.codigoFamiliar.findUnique({
      where: { id: familiarId },
    });

    if (!familiaActual) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado" },
        { status: 404 }
      );
    }

    const dataActualizar: any = {};

    if (body.tutorTitular !== undefined) {
      dataActualizar.tutorTitular = texto(body.tutorTitular);
    }
    if (body.telefonoContacto !== undefined) {
      dataActualizar.telefonoContacto = texto(body.telefonoContacto);
    }
    if (body.correoContacto !== undefined) {
      dataActualizar.correoContacto = texto(body.correoContacto);
    }
    if (body.estado !== undefined) {
      dataActualizar.estado = Boolean(body.estado);
    }

    const familiaActualizada = await prisma.codigoFamiliar.update({
      where: { id: familiarId },
      data: dataActualizar,
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
      accion: "ACTUALIZAR_CODIGO_FAMILIAR",
      modulo: "PADRES",
      detalle: `Actualizado código familiar ${familiaActualizada.codigo} (Estado: ${familiaActualizada.estado ? "Activo" : "Inactivo"})`,
    });

    return NextResponse.json({
      ok: true,
      message: "Datos actualizados correctamente",
      familia: familiaActualizada,
    });
  } catch (error) {
    console.error("Error actualizando familia:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al actualizar familia" },
      { status: 500 }
    );
  }
}

// DELETE /api/padres/[id]
export async function DELETE(
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

    // Desvincular todas las hijas y luego eliminar el código
    await prisma.$transaction([
      prisma.estudiante.updateMany({
        where: { codigoFamiliarId: familiarId },
        data: { codigoFamiliarId: null },
      }),
      prisma.codigoFamiliar.delete({
        where: { id: familiarId },
      }),
    ]);

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "ELIMINAR_CODIGO_FAMILIAR",
      modulo: "PADRES",
      detalle: `Eliminado código familiar ${familia.codigo}. Alumnas desvinculadas sin afectar matrícula.`,
    });

    return NextResponse.json({
      ok: true,
      message: "Código familiar eliminado y estudiantes desvinculadas",
    });
  } catch (error) {
    console.error("Error eliminando familia:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al eliminar familia" },
      { status: 500 }
    );
  }
}
