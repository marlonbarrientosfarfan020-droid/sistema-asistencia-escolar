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
    String(valor ?? "").trim()
  );
}

function obtenerEntero({
  valor,
  minimo,
  maximo,
}: {
  valor: unknown;
  minimo: number;
  maximo: number;
}) {
  const numero = Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero < minimo ||
    numero > maximo
  ) {
    return null;
  }

  return numero;
}

function obtenerBooleano(valor: unknown) {
  if (typeof valor === "boolean") {
    return valor;
  }

  if (valor === "true" || valor === 1) {
    return true;
  }

  if (valor === "false" || valor === 0) {
    return false;
  }

  return null;
}

/* =====================================================
   LISTAR TURNOS
===================================================== */

export async function GET() {
  const acceso =
    await exigirAdminDirectivoDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const turnos =
      await prisma.turno.findMany({
        orderBy: {
          id: "asc",
        },
      });

    return NextResponse.json(turnos);
  } catch (error) {
    console.error(
      "Error obteniendo turnos:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al obtener turnos",
      },
      {
        status: 500,
      }
    );
  }
}

/* =====================================================
   ACTUALIZAR TURNO
===================================================== */

export async function PUT(
  request: Request
) {
  const acceso =
    await exigirAdminODirectivo();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body =
      await request.json();

    const id =
      obtenerEntero({
        valor: body.id,
        minimo: 1,
        maximo:
          Number.MAX_SAFE_INTEGER,
      });

    const nombre =
      String(
        body.nombre ?? ""
      ).trim();

    const horaEntrada =
      String(
        body.horaEntrada ?? ""
      ).trim();

    const horaSalida =
      String(
        body.horaSalida ?? ""
      ).trim();

    /*
     * Minutos que pueden ingresar antes
     * de la hora programada.
     */
    const margenEntradaAnticipadaMinutos =
      obtenerEntero({
        valor:
          body
            .margenEntradaAnticipadaMinutos,
        minimo: 0,
        maximo: 180,
      });

    /*
     * Aviso inicial enviado mientras el
     * alumno aún está dentro del margen.
     */
    const minutosAlertaInicial =
      obtenerEntero({
        valor:
          body.minutosAlertaInicial,
        minimo: 0,
        maximo: 180,
      });

    /*
     * Minutos posteriores a la entrada
     * antes de considerarlo TARDE.
     */
    const margenAlertaMinutos =
      obtenerEntero({
        valor:
          body.margenAlertaMinutos,
        minimo: 0,
        maximo: 180,
      });

    /*
     * Tiempo adicional para marcar salida
     * después de la hora programada.
     */
    const margenSalidaMinutos =
      obtenerEntero({
        valor:
          body.margenSalidaMinutos,
        minimo: 0,
        maximo: 180,
      });

    const estado =
      obtenerBooleano(
        body.estado
      );

    if (!id) {
      return NextResponse.json(
        {
          message:
            "ID de turno inválido",
        },
        {
          status: 400,
        }
      );
    }

    if (!nombre) {
      return NextResponse.json(
        {
          message:
            "El nombre del turno es obligatorio",
        },
        {
          status: 400,
        }
      );
    }

    if (
      nombre.length > 50
    ) {
      return NextResponse.json(
        {
          message:
            "El nombre del turno no puede superar los 50 caracteres",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !horaValida(
        horaEntrada
      )
    ) {
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

    if (
      !horaValida(
        horaSalida
      )
    ) {
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

    if (
      margenEntradaAnticipadaMinutos ===
      null
    ) {
      return NextResponse.json(
        {
          message:
            "El margen de entrada anticipada debe estar entre 0 y 180 minutos",
        },
        {
          status: 400,
        }
      );
    }

    if (
      minutosAlertaInicial ===
      null
    ) {
      return NextResponse.json(
        {
          message:
            "El aviso inicial debe estar entre 0 y 180 minutos",
        },
        {
          status: 400,
        }
      );
    }

    if (
      margenAlertaMinutos ===
      null
    ) {
      return NextResponse.json(
        {
          message:
            "El margen de tardanza debe estar entre 0 y 180 minutos",
        },
        {
          status: 400,
        }
      );
    }

    if (
      margenSalidaMinutos ===
      null
    ) {
      return NextResponse.json(
        {
          message:
            "El margen de salida debe estar entre 0 y 180 minutos",
        },
        {
          status: 400,
        }
      );
    }

    if (estado === null) {
      return NextResponse.json(
        {
          message:
            "El estado del turno no es válido",
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
          message:
            "El turno no existe",
        },
        {
          status: 404,
        }
      );
    }

    const turnoDuplicado =
      await prisma.turno.findFirst({
        where: {
          nombre: {
            equals: nombre,
            mode: "insensitive",
          },

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

    const turno =
      await prisma.turno.update({
        where: {
          id,
        },

        data: {
          nombre,
          horaEntrada,
          horaSalida,

          margenEntradaAnticipadaMinutos,

          minutosAlertaInicial,

          margenAlertaMinutos,

          margenSalidaMinutos,

          estado,
        },
      });

    await prisma.auditoria.create({
      data: {
        usuario:
          acceso.sesion.usuario,

        rol:
          acceso.sesion.rol,

        accion:
          "ACTUALIZAR_TURNO",

        modulo:
          "TURNOS",

        detalle:
          `Se actualizó el turno ${turno.nombre}. ` +
          `Entrada: ${turno.horaEntrada}, ` +
          `entrada anticipada: ${turno.margenEntradaAnticipadaMinutos} min, ` +
          `aviso inicial: ${turno.minutosAlertaInicial} min, ` +
          `tardanza: ${turno.margenAlertaMinutos} min, ` +
          `salida: ${turno.horaSalida}, ` +
          `margen de salida: ${turno.margenSalidaMinutos} min, ` +
          `estado: ${turno.estado ? "ACTIVO" : "INACTIVO"}.`,
      },
    });

    return NextResponse.json({
      ok: true,

      message:
        "Turno actualizado correctamente",

      turno,
    });
  } catch (error) {
    console.error(
      "Error actualizando turno:",
      error
    );

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Error al actualizar turno",
      },
      {
        status: 500,
      }
    );
  }
}