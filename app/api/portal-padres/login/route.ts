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
        { ok: false, message: "El DNI de la estudiante debe contener exactamente 8 dígitos numéricos" },
        { status: 400 }
      );
    }

    if (!claveOculta) {
      return NextResponse.json(
        { ok: false, message: "La contraseña o código familiar es obligatorio" },
        { status: 400 }
      );
    }

    // 1. Verificar si el canal portal web está habilitado en el colegio (Mantenimiento manual por dirección)
    const config = await prisma.configuracion.findFirst({
      select: { canalPortalWebActivo: true },
    });

    if (config && config.canalPortalWebActivo === false) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El portal web de consultas para familias se encuentra temporalmente en mantenimiento por dirección escolar.",
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
          message: "Credenciales de acceso no válidas. Verifique el DNI ingresado o comuníquese con secretaría.",
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
            "El acceso para esta familia se encuentra suspendido. Por favor acérquese a la dirección escolar.",
        },
        { status: 403 }
      );
    }

    // Control anti-fuerza bruta: verificar si la familia está temporalmente bloqueada
    const ahora = new Date();
    if (familia.bloqueadoHasta && familia.bloqueadoHasta > ahora) {
      const minutosRestantes = Math.max(
        1,
        Math.ceil((familia.bloqueadoHasta.getTime() - ahora.getTime()) / 60000)
      );
      return NextResponse.json(
        {
          ok: false,
          message: `Acceso bloqueado temporalmente por seguridad tras múltiples intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s).`,
        },
        { status: 429 }
      );
    }

    // 3. BLOQUEO PREVENTIVO DE CÓDIGOS HIPER-AGRUPADOS INDEBIDOS
    // Si este código familiar tiene más de 2 estudiantes asociadas en la BD (como el código anómalo de 198 alumnas),
    // se bloquea el uso de la credencial compartida para evitar que una persona use el código para ver a otras alumnas.
    if (familia.estudiantes.length > 2 && !(familia as any).hermanosConfirmados) {
      console.warn(
        `[SEGURIDAD] Intento de login con código hiper-agrupado (${familia.codigo}, ${familia.estudiantes.length} alumnas) para DNI ${dni}`
      );
      return NextResponse.json(
        {
          ok: false,
          message:
            "Este código familiar se encuentra en regularización por secretaría. Por favor solicite su credencial individual a la dirección escolar.",
        },
        { status: 403 }
      );
    }

    // 4. Validar Contraseña / Código Familiar Secreto
    const claveIngresadaUpper = claveOculta.toUpperCase();
    let contrasenaValida = false;

    // A) Si la familia tiene passwordHash con bcrypt registrado
    if ((familia as any).passwordHash) {
      contrasenaValida = await bcrypt.compare(claveOculta, (familia as any).passwordHash);
    }

    // B) Fallback de compatibilidad: Código alfanumérico familiar
    if (!contrasenaValida && familia.codigo.toUpperCase() === claveIngresadaUpper) {
      contrasenaValida = true;
    }

    if (!contrasenaValida) {
      const nuevosIntentos = (familia.intentosFallidos || 0) + 1;
      const bloquear = nuevosIntentos >= 5;
      const bloqueadoHasta = bloquear
        ? new Date(ahora.getTime() + 15 * 60 * 1000)
        : null;

      await prisma.codigoFamiliar.update({
        where: { id: familia.id },
        data: {
          intentosFallidos: nuevosIntentos,
          bloqueadoHasta,
        },
      });

      if (bloquear) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Ha superado el límite de 5 intentos fallidos. El acceso ha sido bloqueado temporalmente por 15 minutos.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          message: "Contraseña o código secreto incorrecto. Verifique sus credenciales.",
        },
        { status: 401 }
      );
    }

    // 5. REGLA OBLIGATORIA: CERO PRESUNCIONES PARA HERMANOS
    // Mientras la institución no confirme explícitamente la relación en la base de datos,
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

    // Solo si el campo hermanosConfirmados es true en la BD, autorizar a los demás
    if ((familia as any).hermanosConfirmados === true && familia.estudiantes.length > 1) {
      hermanosPermitidos = familia.estudiantes;
      estudiantesPermitidosIds = familia.estudiantes.map((e) => e.id);
    }

    // 6. Actualizar fecha de último acceso y reiniciar contadores de bloqueo
    await prisma.codigoFamiliar.update({
      where: { id: familia.id },
      data: {
        ultimoIngresoAt: ahora,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    // 7. Crear sesión segura versión 2
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
      { ok: false, message: "Error interno al iniciar sesión en el portal familiar" },
      { status: 500 }
    );
  }
}
