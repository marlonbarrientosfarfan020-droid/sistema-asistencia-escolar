import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminDemoOPersonal } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fechaInicioPeru(fecha: string) {
  return new Date(`${fecha}T00:00:00-05:00`);
}

function fechaFinPeru(fecha: string) {
  return new Date(`${fecha}T23:59:59.999-05:00`);
}

function obtenerFechaPeru(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function calcularMinutosTardanza(
  horaEntradaReal: Date | null,
  horaProgramada: string,
  margenAlertaMinutos: number
) {
  if (!horaEntradaReal) return 0;

  const fechaPeru = obtenerFechaPeru(horaEntradaReal);

  const horaNormalizada =
    /^\d{2}:\d{2}$/.test(horaProgramada)
      ? horaProgramada
      : "00:00";

  const limitePuntualidad = new Date(
    `${fechaPeru}T${horaNormalizada}:00-05:00`
  );

  limitePuntualidad.setMinutes(
    limitePuntualidad.getMinutes() +
      Math.max(margenAlertaMinutos, 0)
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
  const acceso = await exigirAdminDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);

    const fecha =
      searchParams.get("fecha") ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    const dni = String(
      searchParams.get("dni") || ""
    ).trim();

    const tardanzas =
      await prisma.asistencia.findMany({
        where: {
          estado: "TARDE",
          fecha: {
            gte: fechaInicioPeru(fecha),
            lte: fechaFinPeru(fecha),
          },
          estudiante: dni
            ? {
                dni: {
                  contains: dni,
                },
              }
            : undefined,
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