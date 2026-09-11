import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";
import { hashTerminalToken } from "@/lib/terminal-auth";
import { resolverColegio } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET: Listar todas las terminales registradas para el colegio del administrador.
 */
export async function GET(request: Request) {
  const acceso = await exigirAdmin(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }

  const colegioId = tenant.context.colegioId;

  try {
    const terminales = await prisma.terminal.findMany({
      where: { colegioId },
      select: {
        id: true,
        terminalId: true,
        nombre: true,
        colegioId: true,
        estado: true,
        ultimaConexion: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      terminales,
    });
  } catch (error: any) {
    console.error("[API TERMINALES] Error listando terminales:", error);
    return NextResponse.json(
      { ok: false, message: "Error consultando terminales registradas" },
      { status: 500 }
    );
  }
}

/**
 * POST: Registrar una nueva terminal física y generar su token criptográfico seguro.
 */
export async function POST(request: Request) {
  const acceso = await exigirAdmin(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }

  const colegioId = tenant.context.colegioId;

  try {
    const body = await request.json();
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";

    if (!nombre) {
      return NextResponse.json(
        { ok: false, message: "El nombre descriptivo de la terminal es obligatorio." },
        { status: 400 }
      );
    }

    // Generar identificador único de terminal y token seguro de 32 bytes (64 caracteres hex)
    const sufijoAleatorio = crypto.randomBytes(3).toString("hex").toUpperCase();
    const terminalId = `TRM-${colegioId.slice(0, 5)}-${sufijoAleatorio}`;
    const tokenPlano = `sec_${crypto.randomBytes(24).toString("hex")}`;
    const tokenHash = hashTerminalToken(tokenPlano);

    const terminal = await prisma.terminal.create({
      data: {
        terminalId,
        nombre,
        colegioId,
        tokenHash,
        estado: "ACTIVA",
      },
      select: {
        id: true,
        terminalId: true,
        nombre: true,
        colegioId: true,
        estado: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Terminal registrada exitosamente. Guarde el token en un lugar seguro.",
        terminal,
        // El token plano solo se retorna una única vez en la creación
        token: tokenPlano,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[API TERMINALES] Error creando terminal:", error);
    return NextResponse.json(
      { ok: false, message: "Error al registrar la terminal" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Actualizar estado de terminal (ACTIVA, INACTIVA, REVOCADA) o regenerar token.
 */
export async function PATCH(request: Request) {
  const acceso = await exigirAdmin(request);
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  const tenant = resolverColegio(acceso.sesion, request);
  if (!tenant.ok) {
    return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  }

  const colegioId = tenant.context.colegioId;

  try {
    const body = await request.json();
    const terminalId = typeof body.terminalId === "string" ? body.terminalId.trim() : "";
    const nuevoEstado = typeof body.estado === "string" ? body.estado.toUpperCase().trim() : "";
    const regenerarToken = Boolean(body.regenerarToken);

    if (!terminalId) {
      return NextResponse.json(
        { ok: false, message: "Identificador terminalId requerido." },
        { status: 400 }
      );
    }

    const terminalExistente = await prisma.terminal.findFirst({
      where: { terminalId, colegioId },
    });

    if (!terminalExistente) {
      return NextResponse.json(
        { ok: false, message: "Terminal no encontrada en esta institución." },
        { status: 404 }
      );
    }

    const dataUpdate: any = {};
    let nuevoTokenPlano: string | null = null;

    if (nuevoEstado && ["ACTIVA", "INACTIVA", "REVOCADA"].includes(nuevoEstado)) {
      dataUpdate.estado = nuevoEstado;
    }

    if (regenerarToken) {
      nuevoTokenPlano = `sec_${crypto.randomBytes(24).toString("hex")}`;
      dataUpdate.tokenHash = hashTerminalToken(nuevoTokenPlano);
    }

    const terminalActualizada = await prisma.terminal.update({
      where: { id: terminalExistente.id },
      data: dataUpdate,
      select: {
        id: true,
        terminalId: true,
        nombre: true,
        colegioId: true,
        estado: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Terminal actualizada correctamente.",
      terminal: terminalActualizada,
      ...(nuevoTokenPlano ? { token: nuevoTokenPlano } : {}),
    });
  } catch (error: any) {
    console.error("[API TERMINALES] Error actualizando terminal:", error);
    return NextResponse.json(
      { ok: false, message: "Error al actualizar la terminal" },
      { status: 500 }
    );
  }
}
