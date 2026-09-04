import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirAdminODirectivo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/padres/[id]/estudiantes -> Vincular estudiante(s) a la familia
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
    const body = await request.json();
    const estudianteId = Number(body.estudianteId);
    const estudianteIds: number[] = Array.isArray(body.estudianteIds)
      ? body.estudianteIds.map((item: any) => Number(item)).filter(Boolean)
      : estudianteId
      ? [estudianteId]
      : [];

    if (estudianteIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Debe proporcionar al menos un estudiante para vincular" },
        { status: 400 }
      );
    }

    const familia = await prisma.codigoFamiliar.findUnique({
      where: { id: familiarId },
    });

    if (!familia) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado" },
        { status: 404 }
      );
    }

    // Actualizar estudiantes vinculándolos al código familiar
    await prisma.estudiante.updateMany({
      where: { id: { in: estudianteIds } },
      data: { codigoFamiliarId: familiarId },
    });

    // Obtener estudiantes actualizados
    const estudiantes = await prisma.estudiante.findMany({
      where: { id: { in: estudianteIds } },
      select: { id: true, nombres: true, apellidos: true, dni: true },
    });

    const nombresEstudiantes = estudiantes
      .map((e) => `${e.nombres} ${e.apellidos}`)
      .join(", ");

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "VINCULAR_ESTUDIANTE_FAMILIA",
      modulo: "PADRES",
      detalle: `Vinculada(s) estudiante(s) [${nombresEstudiantes}] al código familiar ${familia.codigo}`,
    });

    return NextResponse.json({
      ok: true,
      message: `${estudianteIds.length} estudiante(s) vinculada(s) exitosamente`,
      estudiantes,
    });
  } catch (error) {
    console.error("Error vinculando estudiante a familia:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al vincular estudiante" },
      { status: 500 }
    );
  }
}

// DELETE /api/padres/[id]/estudiantes -> Desvincular un estudiante de la familia
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
    const { searchParams } = new URL(request.url);
    const estudianteIdParam = searchParams.get("estudianteId");
    let estudianteId = Number(estudianteIdParam);

    if (!estudianteId) {
      try {
        const body = await request.json();
        estudianteId = Number(body.estudianteId);
      } catch {}
    }

    if (!estudianteId || isNaN(estudianteId)) {
      return NextResponse.json(
        { ok: false, message: "ID de estudiante obligatorio para desvincular" },
        { status: 400 }
      );
    }

    const familia = await prisma.codigoFamiliar.findUnique({
      where: { id: familiarId },
    });

    if (!familia) {
      return NextResponse.json(
        { ok: false, message: "Código familiar no encontrado" },
        { status: 404 }
      );
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: { id: estudianteId },
      select: { id: true, nombres: true, apellidos: true, codigoFamiliarId: true },
    });

    if (!estudiante || estudiante.codigoFamiliarId !== familiarId) {
      return NextResponse.json(
        { ok: false, message: "El estudiante no pertenece a este código familiar" },
        { status: 400 }
      );
    }

    await prisma.estudiante.update({
      where: { id: estudianteId },
      data: { codigoFamiliarId: null },
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "DESVINCULAR_ESTUDIANTE_FAMILIA",
      modulo: "PADRES",
      detalle: `Desvinculada estudiante ${estudiante.nombres} ${estudiante.apellidos} del código familiar ${familia.codigo}`,
    });

    return NextResponse.json({
      ok: true,
      message: `Estudiante ${estudiante.nombres} ${estudiante.apellidos} desvinculada exitosamente`,
    });
  } catch (error) {
    console.error("Error desvinculando estudiante de familia:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al desvincular estudiante" },
      { status: 500 }
    );
  }
}
