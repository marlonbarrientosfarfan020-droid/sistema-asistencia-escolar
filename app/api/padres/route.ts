import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  exigirAdminODirectivo,
  exigirAdminDirectivoDemoOPersonal,
} from "@/lib/auth";
import { generarCodigoFamiliar, formatoCodigoValido } from "@/lib/codigo-familiar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function texto(valor: unknown): string {
  return String(valor || "").trim();
}

// GET /api/padres
export async function GET(request: Request) {
  const acceso = await exigirAdminDirectivoDemoOPersonal();
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);
    const busqueda = texto(searchParams.get("q"));
    const filtroEstado = searchParams.get("estado"); // "TODOS", "ACTIVO", "INACTIVO"
    const grado = texto(searchParams.get("grado"));
    const seccion = texto(searchParams.get("seccion"));

    // Construcción de condiciones para CodigoFamiliar
    const whereCond: any = {};

    if (filtroEstado === "ACTIVO") {
      whereCond.estado = true;
    } else if (filtroEstado === "INACTIVO") {
      whereCond.estado = false;
    }

    if (busqueda) {
      whereCond.OR = [
        { codigo: { contains: busqueda, mode: "insensitive" } },
        { tutorTitular: { contains: busqueda, mode: "insensitive" } },
        { telefonoContacto: { contains: busqueda, mode: "insensitive" } },
        { correoContacto: { contains: busqueda, mode: "insensitive" } },
        {
          estudiantes: {
            some: {
              OR: [
                { nombres: { contains: busqueda, mode: "insensitive" } },
                { apellidos: { contains: busqueda, mode: "insensitive" } },
                { dni: { contains: busqueda, mode: "insensitive" } },
                { codigo: { contains: busqueda, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    if (grado || seccion) {
      const estudianteFilter: any = {};
      if (grado) estudianteFilter.grado = grado;
      if (seccion) estudianteFilter.seccion = seccion;
      whereCond.estudiantes = {
        some: estudianteFilter,
      };
    }

    // Consultas en paralelo para máximo rendimiento
    const [familias, totalFamilias, familiasActivas, totalEstudiantes, vinculadas, estudiantesSinCodigo] =
      await Promise.all([
        prisma.codigoFamiliar.findMany({
          where: whereCond,
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
              orderBy: [{ grado: "asc" }, { seccion: "asc" }, { apellidos: "asc" }],
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.codigoFamiliar.count(),
        prisma.codigoFamiliar.count({ where: { estado: true } }),
        prisma.estudiante.count({ where: { estado: true } }),
        prisma.estudiante.count({
          where: {
            estado: true,
            codigoFamiliarId: { not: null },
          },
        }),
        prisma.estudiante.findMany({
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
        }),
      ]);

    const estadisticas = {
      totalFamilias,
      familiasActivas,
      familiasInactivas: totalFamilias - familiasActivas,
      totalEstudiantes,
      alumnasVinculadas: vinculadas,
      alumnasSinCodigo: totalEstudiantes - vinculadas,
    };

    return NextResponse.json({
      ok: true,
      familias,
      estudiantesSinCodigo,
      estadisticas,
    });
  } catch (error) {
    console.error("Error obteniendo familias y códigos de acceso:", error);
    return NextResponse.json(
      { ok: false, message: "Error al obtener las familias y códigos" },
      { status: 500 }
    );
  }
}

// POST /api/padres
export async function POST(request: Request) {
  const acceso = await exigirAdminODirectivo();
  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();
    let tutorTitular = texto(body.tutorTitular);
    const telefonoContacto = texto(body.telefonoContacto || body.telefono);
    const correoContacto = texto(body.correoContacto || body.correo);
    const codigoPersonalizado = texto(body.codigoPersonalizado).toUpperCase();
    const estudianteIds: number[] = Array.isArray(body.estudianteIds)
      ? body.estudianteIds.map((id: any) => Number(id)).filter(Boolean)
      : [];

    // Generación o validación de código
    let codigoAsignar = codigoPersonalizado;
    if (codigoAsignar) {
      if (!formatoCodigoValido(codigoAsignar)) {
        return NextResponse.json(
          {
            ok: false,
            message: "El código personalizado no cumple el formato requerido (Ej: SR-2026-AB12)",
          },
          { status: 400 }
        );
      }
      const existe = await prisma.codigoFamiliar.findUnique({
        where: { codigo: codigoAsignar },
      });
      if (existe) {
        return NextResponse.json(
          { ok: false, message: `El código ${codigoAsignar} ya se encuentra registrado` },
          { status: 409 }
        );
      }
    } else {
      // Generar código único evitando colisiones
      let intentos = 0;
      while (!codigoAsignar || intentos < 10) {
        intentos++;
        const candidato = generarCodigoFamiliar();
        const existe = await prisma.codigoFamiliar.findUnique({
          where: { codigo: candidato },
        });
        if (!existe) {
          codigoAsignar = candidato;
          break;
        }
      }
      if (!codigoAsignar) {
        return NextResponse.json(
          { ok: false, message: "No se pudo generar un código único disponible" },
          { status: 500 }
        );
      }
    }

    // Si no se proveyó tutorTitular pero hay estudiantes, tomar el tutor del primer estudiante
    if (!tutorTitular && estudianteIds.length > 0) {
      const primerEstudiante = await prisma.estudiante.findUnique({
        where: { id: estudianteIds[0] },
        select: { nombreTutor: true },
      });
      if (primerEstudiante?.nombreTutor) {
        tutorTitular = primerEstudiante.nombreTutor;
      }
    }

    // Transacción: crear familia y vincular estudiantes
    const resultado = await prisma.$transaction(async (tx) => {
      const nuevaFamilia = await tx.codigoFamiliar.create({
        data: {
          codigo: codigoAsignar,
          tutorTitular,
          telefonoContacto,
          correoContacto,
          estado: true,
        },
      });

      if (estudianteIds.length > 0) {
        await tx.estudiante.updateMany({
          where: { id: { in: estudianteIds } },
          data: { codigoFamiliarId: nuevaFamilia.id },
        });
      }

      return tx.codigoFamiliar.findUnique({
        where: { id: nuevaFamilia.id },
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
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "CREAR_CODIGO_FAMILIAR",
      modulo: "PADRES",
      detalle: `Generado código familiar ${codigoAsignar} con ${estudianteIds.length} estudiante(s) asignada(s)`,
    });

    return NextResponse.json({
      ok: true,
      message: "Código familiar generado exitosamente",
      familia: resultado,
    });
  } catch (error) {
    console.error("Error creando código familiar:", error);
    return NextResponse.json(
      { ok: false, message: "Error interno al crear el código familiar" },
      { status: 500 }
    );
  }
}
