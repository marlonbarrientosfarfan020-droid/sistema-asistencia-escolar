import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardarSesionPadre } from "@/lib/auth-padres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dni = String(body.dni || "").trim();
    const codigoFamiliar = String(body.codigoFamiliar || body.codigo || "").trim().toUpperCase();

    if (!dni || !/^\d{8}$/.test(dni)) {
      return NextResponse.json(
        { ok: false, message: "El DNI debe contener exactamente 8 dígitos" },
        { status: 400 }
      );
    }

    if (!codigoFamiliar) {
      return NextResponse.json(
        { ok: false, message: "El Código Familiar es obligatorio (Ej: SR-2026-XXXX)" },
        { status: 400 }
      );
    }

    // 1. Verificar si el canal portal web está habilitado en el colegio
    const config = await prisma.configuracion.findFirst({
      select: { canalPortalWebActivo: true },
    });

    if (config && !config.canalPortalWebActivo) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El portal web de consultas para familias se encuentra temporalmente en mantenimiento por dirección.",
        },
        { status: 403 }
      );
    }

    // 2. Buscar código familiar
    const familia = await prisma.codigoFamiliar.findUnique({
      where: { codigo: codigoFamiliar },
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

    if (!familia) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Código familiar no encontrado. Verifique el código emitido por el colegio o comuníquese con secretaría.",
        },
        { status: 401 }
      );
    }

    if (!familia.estado) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El acceso para este código familiar se encuentra suspendido. Por favor, acérquese a la dirección escolar.",
        },
        { status: 403 }
      );
    }

    // 3. Verificar que el DNI ingresado pertenezca a una de las hijas de esta familia
    const estudianteValida = familia.estudiantes.find((e) => e.dni === dni);

    if (!estudianteValida) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El DNI ingresado no corresponde a ninguna estudiante asociada a este Código Familiar.",
        },
        { status: 401 }
      );
    }

    // 4. Actualizar fecha de último acceso
    await prisma.codigoFamiliar.update({
      where: { id: familia.id },
      data: { ultimoIngresoAt: new Date() },
    });

    // 5. Crear sesión segura en cookie
    await guardarSesionPadre({
      codigoFamiliarId: familia.id,
      codigoFamiliar: familia.codigo,
      tutorTitular: familia.tutorTitular,
    });

    return NextResponse.json({
      ok: true,
      message: `Bienvenido(a) a la plataforma familiar, apoderado de ${estudianteValida.nombres}`,
      familia: {
        id: familia.id,
        codigo: familia.codigo,
        tutorTitular: familia.tutorTitular,
      },
      estudiantes: familia.estudiantes,
      estudianteActivaId: estudianteValida.id,
    });
  } catch (error) {
    console.error("Error en login de portal de padres:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al iniciar sesión" },
      { status: 500 }
    );
  }
}
