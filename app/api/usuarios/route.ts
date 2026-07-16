import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

import {
  exigirAdmin,
  type RolUsuario,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS: RolUsuario[] = [
  "ADMIN",
  "DIRECTIVO",
  "DEMO",
  "PERSONAL",
];

function texto(valor: unknown) {
  return String(valor || "").trim();
}

function numeroEnteroPositivo(valor: unknown) {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0
    ? numero
    : null;
}

function esRolPermitido(
  valor: string
): valor is RolUsuario {
  return ROLES_PERMITIDOS.includes(
    valor as RolUsuario
  );
}

function validarPassword(password: string) {
  return password.length >= 6;
}

export async function GET() {
  const acceso = await exigirAdmin();

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        usuario: true,
        rol: true,
        estado: true,
        createdAt: true,
      },
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error(
      "Error obteniendo usuarios:",
      error
    );

    return NextResponse.json(
      {
        message: "Error al obtener usuarios",
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

    const usuario = texto(body.usuario);
    const password = String(
      body.password || ""
    );
    const rol = texto(body.rol).toUpperCase();

    if (!usuario || !password || !rol) {
      return NextResponse.json(
        {
          message:
            "Usuario, contraseña y rol son obligatorios",
        },
        {
          status: 400,
        }
      );
    }

    if (usuario.length < 3) {
      return NextResponse.json(
        {
          message:
            "El nombre de usuario debe tener al menos 3 caracteres",
        },
        {
          status: 400,
        }
      );
    }

    if (!validarPassword(password)) {
      return NextResponse.json(
        {
          message:
            "La contraseña debe tener al menos 6 caracteres",
        },
        {
          status: 400,
        }
      );
    }

    if (!esRolPermitido(rol)) {
      return NextResponse.json(
        {
          message:
  "El rol debe ser ADMIN, DIRECTIVO, DEMO o PERSONAL",
        },
        {
          status: 400,
        }
      );
    }

    const existe =
      await prisma.usuario.findUnique({
        where: {
          usuario,
        },
      });

    if (existe) {
      return NextResponse.json(
        {
          message:
            "Ya existe un usuario con ese nombre",
        },
        {
          status: 400,
        }
      );
    }

    const passwordCifrado =
      await bcrypt.hash(password, 12);

    const nuevo =
      await prisma.usuario.create({
        data: {
          usuario,
          password: passwordCifrado,
          rol,
          estado: true,
        },
        select: {
          id: true,
          usuario: true,
          rol: true,
          estado: true,
          createdAt: true,
        },
      });

    return NextResponse.json(nuevo, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "Error creando usuario:",
      error
    );

    return NextResponse.json(
      {
        message: "Error al crear usuario",
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
    const usuario = texto(body.usuario);
    const rol = texto(body.rol).toUpperCase();
    const estado = Boolean(body.estado);
    const password = String(
      body.password || ""
    );

    if (!id || !usuario || !rol) {
      return NextResponse.json(
        {
          message:
            "ID, usuario y rol son obligatorios",
        },
        {
          status: 400,
        }
      );
    }

    if (usuario.length < 3) {
      return NextResponse.json(
        {
          message:
            "El nombre de usuario debe tener al menos 3 caracteres",
        },
        {
          status: 400,
        }
      );
    }

    if (!esRolPermitido(rol)) {
      return NextResponse.json(
        {
          message:
  "El rol debe ser ADMIN, DIRECTIVO, DEMO o PERSONAL",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password &&
      !validarPassword(password)
    ) {
      return NextResponse.json(
        {
          message:
            "La nueva contraseña debe tener al menos 6 caracteres",
        },
        {
          status: 400,
        }
      );
    }

    const usuarioActual =
      await prisma.usuario.findUnique({
        where: {
          id,
        },
      });

    if (!usuarioActual) {
      return NextResponse.json(
        {
          message: "El usuario no existe",
        },
        {
          status: 404,
        }
      );
    }

    const existe =
      await prisma.usuario.findFirst({
        where: {
          usuario,
          NOT: {
            id,
          },
        },
      });

    if (existe) {
      return NextResponse.json(
        {
          message:
            "Ya existe otro usuario con ese nombre",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Evita que el administrador que está usando
     * el sistema se desactive o se quite su propio
     * rol de administrador.
     */
    if (
      id === acceso.sesion.usuarioId &&
      (!estado || rol !== "ADMIN")
    ) {
      return NextResponse.json(
        {
          message:
            "No puede desactivar su propia cuenta ni cambiar su propio rol de administrador",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Evita dejar el sistema sin administradores activos.
     */
    if (
      usuarioActual.rol === "ADMIN" &&
      usuarioActual.estado &&
      (rol !== "ADMIN" || !estado)
    ) {
      const administradoresActivos =
        await prisma.usuario.count({
          where: {
            rol: "ADMIN",
            estado: true,
          },
        });

      if (administradoresActivos <= 1) {
        return NextResponse.json(
          {
            message:
              "No puede desactivar o cambiar el rol del último administrador activo",
          },
          {
            status: 400,
          }
        );
      }
    }

    const dataActualizar: {
      usuario: string;
      rol: RolUsuario;
      estado: boolean;
      password?: string;
    } = {
      usuario,
      rol,
      estado,
    };

    if (password) {
      dataActualizar.password =
        await bcrypt.hash(password, 12);
    }

    const usuarioActualizado =
      await prisma.usuario.update({
        where: {
          id,
        },
        data: dataActualizar,
        select: {
          id: true,
          usuario: true,
          rol: true,
          estado: true,
          createdAt: true,
        },
      });

    return NextResponse.json(
      usuarioActualizado
    );
  } catch (error) {
    console.error(
      "Error actualizando usuario:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al actualizar usuario",
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
    const { searchParams } = new URL(
      request.url
    );

    const id = numeroEnteroPositivo(
      searchParams.get("id")
    );

    if (!id) {
      return NextResponse.json(
        {
          message:
            "El ID del usuario es obligatorio",
        },
        {
          status: 400,
        }
      );
    }

    if (id === acceso.sesion.usuarioId) {
      return NextResponse.json(
        {
          message:
            "No puede eliminar su propia cuenta",
        },
        {
          status: 400,
        }
      );
    }

    const usuario =
      await prisma.usuario.findUnique({
        where: {
          id,
        },
      });

    if (!usuario) {
      return NextResponse.json(
        {
          message: "El usuario no existe",
        },
        {
          status: 404,
        }
      );
    }

    if (
      usuario.rol === "ADMIN" &&
      usuario.estado
    ) {
      const administradoresActivos =
        await prisma.usuario.count({
          where: {
            rol: "ADMIN",
            estado: true,
          },
        });

      if (administradoresActivos <= 1) {
        return NextResponse.json(
          {
            message:
              "No puede eliminar el último administrador activo",
          },
          {
            status: 400,
          }
        );
      }
    }

    await prisma.usuario.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.error(
      "Error eliminando usuario:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al eliminar usuario",
      },
      {
        status: 500,
      }
    );
  }
}