import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exigirAdminODirectivo,
  exigirAdminDirectivoDemoOPersonal,
} from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function horaValida(valor: unknown) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    String(valor || "")
  );
}

function numeroEnteroPositivo(valor: unknown) {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0
    ? numero
    : null;
}

export async function GET() {
  const acceso =
    await exigirAdminDirectivoDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const turnos = await prisma.turno.findMany({
      orderBy: {
        id: "asc",
      },
    });

    return NextResponse.json(turnos);
  } catch (error) {
    console.error("Error obteniendo turnos:", error);

    return NextResponse.json(
      {
        message: "Error al obtener turnos",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(request: Request) {
  const acceso = await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const id = numeroEnteroPositivo(body.id);

    const nombre = String(
      body.nombre || ""
    ).trim();

    const horaEntrada = String(
      body.horaEntrada || ""
    ).trim();

    const horaSalida = String(
      body.horaSalida || ""
    ).trim();

    const margenAlertaMinutos =
      numeroEnteroPositivo(
        body.margenAlertaMinutos || 120
      );

    if (!id) {
      return NextResponse.json(
        {
          message: "ID de turno inválido",
        },
        {
          status: 400,
        }
      );
    }

    if (!nombre) {
      return NextResponse.json(
        {
          message: "El nombre del turno es obligatorio",
        },
        {
          status: 400,
        }
      );
    }

    if (!horaValida(horaEntrada)) {
      return NextResponse.json(
        {
          message:
            "La hora de entrada debe tener formato HH:mm",
        },
        {
          status: 400,
        }
      );
    }

    if (!horaValida(horaSalida)) {
      return NextResponse.json(
        {
          message:
            "La hora de salida debe tener formato HH:mm",
        },
        {
          status: 400,
        }
      );
    }

    if (!margenAlertaMinutos) {
      return NextResponse.json(
        {
          message:
            "El margen de alerta debe ser mayor a 0 minutos",
        },
        {
          status: 400,
        }
      );
    }

    const turnoActual =
      await prisma.turno.findUnique({
        where: {
          id,
        },
      });

    if (!turnoActual) {
      return NextResponse.json(
        {
          message: "El turno no existe",
        },
        {
          status: 404,
        }
      );
    }

    const turnoDuplicado =
      await prisma.turno.findFirst({
        where: {
          nombre,
          NOT: {
            id,
          },
        },
      });

    if (turnoDuplicado) {
      return NextResponse.json(
        {
          message:
            "Ya existe otro turno con ese nombre",
        },
        {
          status: 400,
        }
      );
    }

    const turno = await prisma.turno.update({
      where: {
        id,
      },
      data: {
        nombre,
        horaEntrada,
        horaSalida,
        margenAlertaMinutos,
        estado: Boolean(body.estado),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Turno actualizado correctamente",
      turno,
    });
  } catch (error) {
    console.error("Error actualizando turno:", error);

    return NextResponse.json(
      {
        message: "Error al actualizar turno",
      },
      {
        status: 500,
      }
    );
  }
}