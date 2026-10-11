import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesion } from "@/lib/auth";
import { obtenerSesionPadre } from "@/lib/auth-padres";
import { fechaPeru } from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLEGIO_DEFAULT_ID = "SANTA_RITA_001";

/**
 * GET /api/realtime/sync?ultimoId=123&desde=2026-10-10T13:30:00Z&limite=50
 * Endpoint de sincronización incremental resiliente a Vercel Serverless.
 * Consulta registros recientes en PostgreSQL filtrando por colegio y permisos.
 * Detecta tanto nuevas ENTRADAS (id > ultimoId o horaEntrada >= desde)
 * como SALIDAS actualizadas sobre registros existentes (horaSalida >= desde).
 */
export async function GET(request: Request) {
  const sesionPersonal = await obtenerSesion(request);
  let sesionPadre = null;

  if (!sesionPersonal) {
    sesionPadre = await obtenerSesionPadre(request);
  }

  if (!sesionPersonal && !sesionPadre) {
    return NextResponse.json(
      { ok: false, message: "No autorizado. Debe iniciar sesión para sincronizar eventos." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const ultimoIdRaw = searchParams.get("ultimoId");
  const limiteRaw = searchParams.get("limite");
  const desdeRaw = searchParams.get("desde");

  const ultimoId = Number(ultimoIdRaw) || 0;
  const limite = Math.min(Math.max(Number(limiteRaw) || 50, 1), 100);

  const colegioId = sesionPersonal?.colegioId || sesionPadre?.colegioId || COLEGIO_DEFAULT_ID;
  const esSuperAdmin = sesionPersonal?.rol === "SUPER_ADMIN";
  const hoyStr = fechaPeru();

  let desdeDate: Date | null = null;
  if (desdeRaw) {
    const d = new Date(desdeRaw);
    if (!isNaN(d.getTime())) {
      // Margen de 5 segundos de tolerancia para concurrencia de transacciones
      desdeDate = new Date(d.getTime() - 5000);
    }
  }

  const whereClausula: any = {
    fechaDia: hoyStr,
  };

  if (!esSuperAdmin) {
    whereClausula.colegioId = colegioId;
  }

  if (sesionPadre) {
    const permitidos = sesionPadre.estudiantesPermitidosIds || [sesionPadre.estudianteAutorizadoId];
    whereClausula.estudianteId = { in: permitidos };
  }

  // Soporte bidireccional de sincronización:
  // 1. Nuevas entradas con id > ultimoId
  // 2. Salidas actualizadas con horaSalida >= desdeDate
  // 3. Entradas regularizadas con horaEntrada >= desdeDate
  if (ultimoId > 0 || desdeDate) {
    const orCondiciones: any[] = [];
    if (ultimoId > 0) {
      orCondiciones.push({ id: { gt: ultimoId } });
    }
    if (desdeDate) {
      orCondiciones.push({ horaSalida: { gte: desdeDate } });
      orCondiciones.push({ horaEntrada: { gte: desdeDate } });
    }
    whereClausula.OR = orCondiciones;
  }

  try {
    const registros = await prisma.asistencia.findMany({
      where: whereClausula,
      include: {
        estudiante: {
          select: {
            id: true,
            codigo: true,
            dni: true,
            nombres: true,
            apellidos: true,
            grado: true,
            seccion: true,
            nombreTutor: true,
            turno: {
              select: {
                id: true,
                nombre: true,
                horaEntrada: true,
                horaSalida: true,
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: limite,
    });

    let maxId = ultimoId;

    const asistenciasSeguras = registros.map((r) => {
      if (r.id > maxId) maxId = r.id;

      const tipoEvento = r.horaSalida ? "SALIDA" : "ENTRADA";
      const fotoProxy = r.fotoUrl || r.fotoEntrada || r.fotoSalida
        ? `/api/portal-padres/foto?asistenciaId=${r.id}&tipo=${tipoEvento}`
        : null;

      return {
        id: r.id,
        asistenciaId: r.id,
        colegioId: r.colegioId,
        estudianteId: r.estudianteId,
        estudiante: r.estudiante,
        fecha: r.fechaDia,
        horaEntrada: r.horaEntrada,
        horaSalida: r.horaSalida,
        estado: r.estado,
        estadoJornada: r.estadoJornada,
        estadoSalida: r.estadoSalida,
        metodo: r.metodo,
        tipo: tipoEvento,
        fotoUrl: fotoProxy,
        updatedAt: r.horaSalida || r.horaEntrada || r.fecha,
      };
    });

    return NextResponse.json({
      ok: true,
      colegioId,
      ultimoId: maxId,
      servidorTimestamp: new Date().toISOString(),
      totalNuevas: asistenciasSeguras.length,
      asistencias: asistenciasSeguras,
      sincronizadoAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[REALTIME SYNC] Error consultando PostgreSQL:", error);
    return NextResponse.json(
      { ok: false, message: "Error al sincronizar marcaciones en tiempo real." },
      { status: 500 }
    );
  }
}
