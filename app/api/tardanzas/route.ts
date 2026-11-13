import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDemoOPersonal, obtenerColegioId } from "@/lib/auth";
import {
  crearFechaHoraPeru,
  fechaPeru,
  obtenerLimitesDiaPeru,
  obtenerLimitePuntualidad,
} from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function calcularMinutosTardanza(
  horaEntradaReal: Date | null,
  horaProgramada: string,
  margenAlertaMinutos: number
) {
  if (!horaEntradaReal) return 0;

  const fechaIngreso = fechaPeru(horaEntradaReal);
  const horaBase = crearFechaHoraPeru(fechaIngreso, horaProgramada);
  const limitePuntualidad = obtenerLimitePuntualidad(
    horaBase,
    margenAlertaMinutos
  );

  const diferencia =
    horaEntradaReal.getTime() -
    limitePuntualidad.getTime();

  return Math.max(
    Math.floor(diferencia / 60000),
    0
  );
}

export async function GET(request: Request) {
  const acceso = await exigirAdminDemoOPersonal(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const colegioId = obtenerColegioId(acceso.sesion, request);
    const { searchParams } = new URL(request.url);

    const fecha =
      searchParams.get("fecha") ||
      fechaPeru();

    const dni = String(
      searchParams.get("dni") || ""
    ).trim();

    const { inicioDia, finDia } = obtenerLimitesDiaPeru(fecha);

    const tardanzas =
      await prisma.asistencia.findMany({
        where: {
          colegioId,
          estado: "TARDE",
          OR: [
            { fechaDia: fecha },
            {
              fechaDia: "",
              fecha: {
                gte: inicioDia,
                lte: finDia,
              },
            },
          ],
          estudiante: {
            colegioId,
            ...(dni
              ? {
                  dni: {
                    contains: dni,
                  },
                }
              : {}),
          },
        },
        include: {
          estudiante: {
            include: {
              turno: true,
            },
          },
        },
        orderBy: {
          horaEntrada: "desc",
        },
      });

    const detalle = tardanzas.map(
      (registro) => ({
        id: registro.id,
        fecha: registro.fecha,
        horaEntrada: registro.horaEntrada,
        metodo: registro.metodo,
        estudiante: {
          id: registro.estudiante.id,
          dni: registro.estudiante.dni,
          nombres:
            registro.estudiante.nombres,
          apellidos:
            registro.estudiante.apellidos,
          grado: registro.estudiante.grado,
          seccion:
            registro.estudiante.seccion,
          turno:
            registro.estudiante.turno
              ?.nombre || "Sin turno",
        },
        minutosTardanza:
  calcularMinutosTardanza(
    registro.horaEntrada,
    registro.estudiante.turno?.horaEntrada || "00:00",
    registro.estudiante.turno?.margenAlertaMinutos || 0
  ),
      })
    );

    return NextResponse.json({
      ok: true,
      fecha,
      total: detalle.length,
      tardanzas: detalle,
    });
  } catch (error) {
    console.error(
      "Error obteniendo tardanzas:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Error al obtener tardanzas",
      },
      {
        status: 500,
      }
    );
  }
}