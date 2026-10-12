import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { exigirAdmin, type RolUsuario } from "@/lib/auth";
import {
  MODULOS_OPERATIVOS,
  MAPA_MODULOS,
  obtenerModulosPorRol,
} from "@/lib/modulos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS: RolUsuario[] = [
  "ADMIN",
  "DIRECTIVO",
  "DIRECTOR",
  "DOCENTE",
  "SECRETARIA",
  "PORTERIA",
  "DEMO",
  "PERSONAL",
  "PERSONALIZADO",
];

function texto(valor: unknown) {
  return String(valor || "").trim();
}

function numeroEnteroPositivo(valor: unknown) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function esRolPermitido(valor: string): valor is RolUsuario {
  return ROLES_PERMITIDOS.includes(valor as RolUsuario);
}

function validarPassword(password: string) {
  return password.length >= 6;
}

export async function GET(request: Request) {
  const acceso = await exigirAdmin(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const filtroColegio =
      acceso.sesion.rol === "SUPER_ADMIN"
        ? {}
        : acceso.sesion.colegioId
        ? { colegioId: acceso.sesion.colegioId }
        : {};

    const usuarios = await prisma.usuario.findMany({
      where: filtroColegio,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        modulosPermitidos: {
          select: {
            modulo: true,
          },
        },
      },
    });

    const usuariosConModulos = usuarios.map((u) => {
      const modulosDb = u.modulosPermitidos.map((m) => m.modulo);
      const modulos =
        modulosDb.length > 0 ? modulosDb : obtenerModulosPorRol(u.rol);

      return {
        id: u.id,
        usuario: u.usuario,
        rol: u.rol,
        estado: u.estado,
        colegioId: u.colegioId,
        createdAt: u.createdAt,
        modulos,
        totalModulos: modulos.length,
      };
    });

    return NextResponse.json(usuariosConModulos);
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    return NextResponse.json(
      { message: "Error al obtener usuarios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const acceso = await exigirAdmin(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const usuario = texto(body.usuario);
    const password = String(body.password || "");
    const rol = texto(body.rol).toUpperCase();
    const estado = body.estado !== undefined ? Boolean(body.estado) : true;
    const colegioId =
      texto(body.colegioId) ||
      acceso.sesion.colegioId ||
      "SANTA_RITA_001";

    if (!usuario || !password || !rol) {
      return NextResponse.json(
        { message: "Usuario, contraseña y rol son obligatorios" },
        { status: 400 }
      );
    }

    if (usuario.length < 3) {
      return NextResponse.json(
        { message: "El nombre de usuario debe tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    if (!validarPassword(password)) {
      return NextResponse.json(
        { message: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    if (!esRolPermitido(rol)) {
      return NextResponse.json(
        {
          message:
            "El rol no es válido. Roles válidos: ADMIN, DIRECTIVO, DOCENTE, SECRETARIA, PORTERIA, DEMO, PERSONAL, PERSONALIZADO",
        },
        { status: 400 }
      );
    }

    const existe = await prisma.usuario.findUnique({
      where: { usuario },
    });

    if (existe) {
      return NextResponse.json(
        { message: "Ya existe un usuario con ese nombre o correo" },
        { status: 400 }
      );
    }

    // Filtrar módulos válidos
    let modulosFinales: string[] = [];
    if (Array.isArray(body.modulos)) {
      modulosFinales = body.modulos.filter(
        (m: unknown) => typeof m === "string" && Boolean(MAPA_MODULOS[m])
      );
    } else {
      modulosFinales = obtenerModulosPorRol(rol);
    }

    // Si el rol es ADMIN, garantizar acceso al módulo usuarios
    if (rol === "ADMIN" && !modulosFinales.includes("usuarios")) {
      modulosFinales.push("usuarios");
    }

    const passwordCifrado = await bcrypt.hash(password, 12);

    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: {
          usuario,
          password: passwordCifrado,
          rol,
          estado,
          colegioId,
        },
        select: {
          id: true,
          usuario: true,
          rol: true,
          estado: true,
          colegioId: true,
          createdAt: true,
        },
      });

      if (modulosFinales.length > 0) {
        await tx.usuarioModulo.createMany({
          data: modulosFinales.map((modulo) => ({
            usuarioId: creado.id,
            modulo,
          })),
        });
      }

      return {
        ...creado,
        modulos: modulosFinales,
        totalModulos: modulosFinales.length,
      };
    });

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    console.error("Error creando usuario:", error);
    return NextResponse.json(
      { message: "Error al crear usuario" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const acceso = await exigirAdmin(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const body = await request.json();

    const id = numeroEnteroPositivo(body.id);
    const usuario = texto(body.usuario);
    const rol = texto(body.rol).toUpperCase();
    const estado = Boolean(body.estado);
    const password = String(body.password || "");

    if (!id || !usuario || !rol) {
      return NextResponse.json(
        { message: "ID, usuario y rol son obligatorios" },
        { status: 400 }
      );
    }

    if (usuario.length < 3) {
      return NextResponse.json(
        { message: "El nombre de usuario debe tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    if (!esRolPermitido(rol)) {
      return NextResponse.json(
        {
          message:
            "El rol no es válido. Roles válidos: ADMIN, DIRECTIVO, DOCENTE, SECRETARIA, PORTERIA, DEMO, PERSONAL, PERSONALIZADO",
        },
        { status: 400 }
      );
    }

    if (password && !validarPassword(password)) {
      return NextResponse.json(
        { message: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const usuarioActual = await prisma.usuario.findUnique({
      where: { id },
      include: {
        modulosPermitidos: true,
      },
    });

    if (!usuarioActual) {
      return NextResponse.json(
        { message: "El usuario no existe" },
        { status: 404 }
      );
    }

    // Aislamiento multi-institución
    if (
      acceso.sesion.rol !== "SUPER_ADMIN" &&
      acceso.sesion.colegioId &&
      usuarioActual.colegioId &&
      usuarioActual.colegioId !== acceso.sesion.colegioId
    ) {
      return NextResponse.json(
        { message: "No tiene permisos para modificar usuarios de otra institución" },
        { status: 403 }
      );
    }

    const existeOtro = await prisma.usuario.findFirst({
      where: {
        usuario,
        NOT: { id },
      },
    });

    if (existeOtro) {
      return NextResponse.json(
        { message: "Ya existe otro usuario con ese nombre" },
        { status: 400 }
      );
    }

    // Evitar que el administrador se desactive a sí mismo o se quite su rol
    if (id === acceso.sesion.usuarioId && (!estado || rol !== "ADMIN")) {
      return NextResponse.json(
        {
          message:
            "No puede desactivar su propia cuenta ni remover su propio rol de administrador",
        },
        { status: 400 }
      );
    }

    // Procesar módulos a guardar
    let modulosFinales: string[] | undefined = undefined;
    if (Array.isArray(body.modulos)) {
      modulosFinales = body.modulos.filter(
        (m: unknown) => typeof m === "string" && Boolean(MAPA_MODULOS[m])
      );
    }

    // Protección del último administrador
    if (usuarioActual.rol === "ADMIN" && usuarioActual.estado) {
      const administradoresActivos = await prisma.usuario.count({
        where: {
          rol: "ADMIN",
          estado: true,
        },
      });

      if (administradoresActivos <= 1) {
        if (rol !== "ADMIN" || !estado) {
          return NextResponse.json(
            {
              message:
                "No puede desactivar o cambiar el rol del último administrador activo del sistema",
            },
            { status: 400 }
          );
        }

        if (modulosFinales && !modulosFinales.includes("usuarios")) {
          return NextResponse.json(
            {
              message:
                "El administrador principal no puede quedarse sin acceso al módulo de Usuarios",
            },
            { status: 400 }
          );
        }
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
      dataActualizar.password = await bcrypt.hash(password, 12);
    }

    const usuarioModificado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { id },
        data: dataActualizar,
        select: {
          id: true,
          usuario: true,
          rol: true,
          estado: true,
          colegioId: true,
          createdAt: true,
        },
      });

      if (modulosFinales !== undefined) {
        await tx.usuarioModulo.deleteMany({
          where: { usuarioId: id },
        });

        if (modulosFinales.length > 0) {
          await tx.usuarioModulo.createMany({
            data: modulosFinales.map((modulo) => ({
              usuarioId: id,
              modulo,
            })),
          });
        }
      }

      const modulosActuales = await tx.usuarioModulo.findMany({
        where: { usuarioId: id },
        select: { modulo: true },
      });

      const modulosResultado =
        modulosActuales.length > 0
          ? modulosActuales.map((m) => m.modulo)
          : obtenerModulosPorRol(actualizado.rol);

      return {
        ...actualizado,
        modulos: modulosResultado,
        totalModulos: modulosResultado.length,
      };
    });

    return NextResponse.json(usuarioModificado);
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return NextResponse.json(
      { message: "Error al actualizar usuario" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const acceso = await exigirAdmin(request);

  if (!acceso.autorizado) {
    return acceso.respuesta;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = numeroEnteroPositivo(searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        { message: "El ID del usuario es obligatorio" },
        { status: 400 }
      );
    }

    if (id === acceso.sesion.usuarioId) {
      return NextResponse.json(
        { message: "No puede eliminar su propia cuenta" },
        { status: 400 }
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return NextResponse.json(
        { message: "El usuario no existe" },
        { status: 404 }
      );
    }

    // Aislamiento multi-institución
    if (
      acceso.sesion.rol !== "SUPER_ADMIN" &&
      acceso.sesion.colegioId &&
      usuario.colegioId &&
      usuario.colegioId !== acceso.sesion.colegioId
    ) {
      return NextResponse.json(
        { message: "No puede eliminar usuarios de otra institución" },
        { status: 403 }
      );
    }

    if (usuario.rol === "ADMIN" && usuario.estado) {
      const administradoresActivos = await prisma.usuario.count({
        where: {
          rol: "ADMIN",
          estado: true,
        },
      });

      if (administradoresActivos <= 1) {
        return NextResponse.json(
          {
            message:
              "No puede eliminar el último administrador activo del sistema",
          },
          { status: 400 }
        );
      }
    }

    // Borrado en cascada
    await prisma.usuario.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    return NextResponse.json(
      { message: "Error al eliminar usuario" },
      { status: 500 }
    );
  }
}
