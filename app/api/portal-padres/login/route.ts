import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardarSesionPadre } from "@/lib/auth-padres";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dni = String(body.dni || "").trim();
    const claveOculta = String(body.password || body.codigoFamiliar || body.codigo || "").trim();

    if (!dni || !/^\d{8}$/.test(dni)) {
      return NextResponse.json(
        { ok: false, message: "El DNI de la estudiante debe contener exactamente 8 d�gitos num�ricos" },
        { status: 400 }
      );
    }

    if (!claveOculta) {
      return NextResponse.json(
        { ok: false, message: "La contrase�a o c�digo familiar es obligatorio" },
        { status: 400 }
      );
    }

    // 1. Verificar si el canal portal web est� habilitado en el colegio (Mantenimiento manual por direcci�n)
    const config = await prisma.configuracion.findFirst({
      select: { canalPortalWebActivo: true },
    });

    if (config && config.canalPortalWebActivo === false) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El portal web de consultas para familias se encuentra temporalmente en mantenimiento por direcci�n escolar.",
        },
        { status: 403 }
      );
    }

    // 2. Buscar estudiante directamente por DNI con su familia asignada en PostgreSQL
    const estudiante = await prisma.estudiante.findUnique({
      where: { dni },
      include: {
        codigoFamiliar: {
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
        },
      },
    });

    if (!estudiante || !estudiante.estado || !estudiante.codigoFamiliar) {
      return NextResponse.json(
        {
          ok: false,
          message: "Credenciales de acceso no v�lidas. Verifique el DNI ingresado o comun�quese con secretar�a.",
        },
        { status: 401 }
      );
    }

    const familia = estudiante.codigoFamiliar;

    if (!familia.estado) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El acceso para esta familia se encuentra suspendido. Por favor ac�rquese a la direcci�n escolar.",
        },
        { status: 403 }
      );
    }

    // 3. BLOQUEO PREVENTIVO DE C�DIGOS HIPER-AGRUPADOS INDEBIDOS
    // Si este c�digo familiar tiene m�s de 2 estudiantes asociadas en la BD (como el c�digo an�malo de 198 alumnas),
    // se bloquea el uso de la credencial compartida para evitar que una persona use el c�digo para ver a otras alumnas.
    if (familia.estudiantes.length > 2 && !(familia as any).hermanosConfirmados) {
      console.warn(
        `[SEGURIDAD] Intento de login con c�digo hiper-agrupado (${familia.codigo}, ${familia.estudiantes.length} alumnas) para DNI ${dni}`
      );
      return NextResponse.json(
        {
          ok: false,
          message:
            "Este c�digo familiar se encuentra en regularizaci�n por secretar�a. Por favor solicite su credencial individual a la direcci�n escolar.",
        },
        { status: 403 }
      );
    }

    // 4. Validar Contrase�a / C�digo Familiar Secreto
    const claveIngresadaUpper = claveOculta.toUpperCase();
    let contrasenaValida = false;

    // A) Si la familia tiene passwordHash con bcrypt registrado
    if ((familia as any).passwordHash) {
      contrasenaValida = await bcrypt.compare(claveOculta, (familia as any).passwordHash);
    }

    // B) Fallback de compatibilidad: C�digo alfanum�rico familiar
    if (!contrasenaValida && familia.codigo.toUpperCase() === claveIngresadaUpper) {
      contrasenaValida = true;
    }

    if (!contrasenaValida) {
      return NextResponse.json(
        {
          ok: false,
          message: "Contrase�a o c�digo secreto incorrecto. Verifique sus credenciales.",
        },
        { status: 401 }
      );
    }

    // 5. REGLA OBLIGATORIA: CERO PRESUNCIONES PARA HERMANOS
    // Mientras la instituci�n no confirme expl�citamente la relaci�n en la base de datos,
    // se autoriza EXCLUSIVAMENTE al estudiante autenticado por su DNI.
    let hermanosPermitidos = [
      {
        id: estudiante.id,
        codigo: estudiante.codigo,
        dni: estudiante.dni,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
      },
    ];
    let estudiantesPermitidosIds = [estudiante.id];

    // Solo si el campo hermanosConfirmados es true en la BD, autorizar a los dem�s
    if ((familia as any).hermanosConfirmados === true && familia.estudiantes.length > 1) {
      hermanosPermitidos = familia.estudiantes;
      estudiantesPermitidosIds = familia.estudiantes.map((e) => e.id);
    }

    // 6. Actualizar fecha de �ltimo acceso
    await prisma.codigoFamiliar.update({
      where: { id: familia.id },
      data: { ultimoIngresoAt: new Date() },
    });

    // 7. Crear sesi�n segura versi�n 2
    await guardarSesionPadre({
      codigoFamiliarId: familia.id,
      codigoFamiliar: familia.codigo,
      tutorTitular: familia.tutorTitular,
      estudianteAutorizadoId: estudiante.id,
      estudiantesPermitidosIds,
      colegioId: estudiante.colegioId,
      versionSesion: 2,
    });

    return NextResponse.json({
      ok: true,
      message: `Bienvenido(a) al portal familiar, apoderado de ${estudiante.nombres}`,
      familia: {
        id: familia.id,
        codigo: familia.codigo,
        tutorTitular: familia.tutorTitular,
      },
      estudiantes: hermanosPermitidos,
      estudianteActivaId: estudiante.id,
    });
  } catch (error) {
    console.error("Error en login de portal de padres:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al iniciar sesi�n en el portal familiar" },
      { status: 500 }
    );
  }
}
