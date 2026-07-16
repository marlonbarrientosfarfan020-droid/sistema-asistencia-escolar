import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  
  exigirAdmin,
  exigirAdminDemoOPersonal,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function texto(valor: unknown) {
  return String(valor || "").trim();
}

function numeroEnteroPositivo(valor: unknown) {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0
    ? numero
    : null;
}

function validarDatosEstudiante(body: Record<string, unknown>) {
  const codigo = texto(body.codigo);
  const dni = texto(body.dni);
  const nombres = texto(body.nombres);
  const apellidos = texto(body.apellidos);
  const grado = texto(body.grado);
  const seccion = texto(body.seccion);

  if (!codigo) {
    return {
      ok: false as const,
      message: "El código es obligatorio",
    };
  }

  if (!/^\d{8}$/.test(dni)) {
    return {
      ok: false as const,
      message: "El DNI debe contener exactamente 8 dígitos",
    };
  }

  if (!nombres) {
    return {
      ok: false as const,
      message: "Los nombres son obligatorios",
    };
  }

  if (!apellidos) {
    return {
      ok: false as const,
      message: "Los apellidos son obligatorios",
    };
  }

  if (!grado) {
    return {
      ok: false as const,
      message: "El grado es obligatorio",
    };
  }

  if (!seccion) {
    return {
      ok: false as const,
      message: "La sección es obligatoria",
    };
  }

  const turnoId =
    body.turnoId === null ||
    body.turnoId === undefined ||
    body.turnoId === ""
      ? null
      : numeroEnteroPositivo(body.turnoId);

  if (
    body.turnoId !== null &&
    body.turnoId !== undefined &&
    body.turnoId !== "" &&
    turnoId === null
  ) {
    return {
      ok: false as const,
      message: "El turno seleccionado no es válido",
    };
  }

  return {
    ok: true as const,
    data: {
      codigo,
      dni,
      nombres,
      apellidos,
      grado,
      seccion,
      nombreTutor: texto(body.nombreTutor),
      whatsapp: texto(body.whatsapp),
      telegramChatId: texto(body.telegramChatId),
      turnoId,
    },
  };
}

export async function GET() {
  const acceso = await exigirAdminDemoOPersonal();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const estudiantes = await prisma.estudiante.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        turno: true,
        riesgoIA: true,
      },
    });

    return NextResponse.json(estudiantes);
  } catch (error) {
    console.error("Error obteniendo estudiantes:", error);

    return NextResponse.json(
      {
        message: "Error al obtener estudiantes",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const validacion = validarDatosEstudiante(body);

    if (!validacion.ok) {
      return NextResponse.json(
        {
          message: validacion.message,
        },
        {
          status: 400,
        }
      );
    }

    const datos = validacion.data;

    const existeDni = await prisma.estudiante.findUnique({
      where: {
        dni: datos.dni,
      },
    });

    if (existeDni) {
      return NextResponse.json(
        {
          message: "Ya existe un estudiante con ese DNI",
        },
        {
          status: 400,
        }
      );
    }

    const existeCodigo = await prisma.estudiante.findUnique({
      where: {
        codigo: datos.codigo,
      },
    });

    if (existeCodigo) {
      return NextResponse.json(
        {
          message: "Ya existe un estudiante con ese código",
        },
        {
          status: 400,
        }
      );
    }

    if (datos.turnoId !== null) {
      const turno = await prisma.turno.findUnique({
        where: {
          id: datos.turnoId,
        },
      });

      if (!turno) {
        return NextResponse.json(
          {
            message: "El turno seleccionado no existe",
          },
          {
            status: 400,
          }
        );
      }
    }

    const estudiante = await prisma.estudiante.create({
      data: datos,
      include: {
        turno: true,
        riesgoIA: true,
      },
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "CREAR",
      modulo: "Estudiantes",
      detalle: `Registró al estudiante ${estudiante.nombres} ${estudiante.apellidos} con DNI ${estudiante.dni}`,
    });

    return NextResponse.json(estudiante, {
      status: 201,
    });
  } catch (error) {
    console.error("Error guardando estudiante:", error);

    return NextResponse.json(
      {
        message: "Error al guardar estudiante",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const id = numeroEnteroPositivo(body.id);

    if (!id) {
      return NextResponse.json(
        {
          message: "El ID del estudiante no es válido",
        },
        {
          status: 400,
        }
      );
    }

    const estudianteActual = await prisma.estudiante.findUnique({
      where: {
        id,
      },
    });

    if (!estudianteActual) {
      return NextResponse.json(
        {
          message: "El estudiante no existe",
        },
        {
          status: 404,
        }
      );
    }

    const validacion = validarDatosEstudiante(body);

    if (!validacion.ok) {
      return NextResponse.json(
        {
          message: validacion.message,
        },
        {
          status: 400,
        }
      );
    }

    const datos = validacion.data;

    const existeDni = await prisma.estudiante.findFirst({
      where: {
        dni: datos.dni,
        NOT: {
          id,
        },
      },
    });

    if (existeDni) {
      return NextResponse.json(
        {
          message: "Ya existe otro estudiante con ese DNI",
        },
        {
          status: 400,
        }
      );
    }

    const existeCodigo = await prisma.estudiante.findFirst({
      where: {
        codigo: datos.codigo,
        NOT: {
          id,
        },
      },
    });

    if (existeCodigo) {
      return NextResponse.json(
        {
          message: "Ya existe otro estudiante con ese código",
        },
        {
          status: 400,
        }
      );
    }

    if (datos.turnoId !== null) {
      const turno = await prisma.turno.findUnique({
        where: {
          id: datos.turnoId,
        },
      });

      if (!turno) {
        return NextResponse.json(
          {
            message: "El turno seleccionado no existe",
          },
          {
            status: 400,
          }
        );
      }
    }

    const estudiante = await prisma.estudiante.update({
      where: {
        id,
      },
      data: datos,
      include: {
        turno: true,
        riesgoIA: true,
      },
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "EDITAR",
      modulo: "Estudiantes",
      detalle: `Actualizó al estudiante ${estudiante.nombres} ${estudiante.apellidos} con DNI ${estudiante.dni}`,
    });

    return NextResponse.json(estudiante);
  } catch (error) {
    console.error("Error actualizando estudiante:", error);

    return NextResponse.json(
      {
        message: "Error al actualizar estudiante",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request: Request) {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);

    const id = numeroEnteroPositivo(
      searchParams.get("id")
    );

    if (!id) {
      return NextResponse.json(
        {
          message: "El ID del estudiante es obligatorio",
        },
        {
          status: 400,
        }
      );
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: {
        id,
      },
    });

    if (!estudiante) {
      return NextResponse.json(
        {
          message: "El estudiante no existe",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.estudiante.delete({
      where: {
        id,
      },
    });

    await registrarAuditoria({
      usuario: acceso.sesion.usuario,
      rol: acceso.sesion.rol,
      accion: "ELIMINAR",
      modulo: "Estudiantes",
      detalle: `Eliminó al estudiante ${estudiante.nombres} ${estudiante.apellidos} con DNI ${estudiante.dni}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Estudiante eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando estudiante:", error);

    return NextResponse.json(
      {
        message: "Error al eliminar estudiante",
      },
      {
        status: 500,
      }
    );
  }
}