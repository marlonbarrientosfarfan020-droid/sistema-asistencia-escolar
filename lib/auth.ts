import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { validarTerminalRequest } from "@/lib/terminal-auth";
import { obtenerModulosPorRol } from "@/lib/modulos";

const COOKIE_NAME = "sesion_santa_rita";

export type RolUsuario =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ADMIN_COLEGIO"
  | "DIRECTIVO"
  | "DIRECTOR"
  | "DOCENTE"
  | "SECRETARIA"
  | "PORTERIA"
  | "DEMO"
  | "PERSONAL"
  | "PERSONALIZADO"
  | "PADRE";

export type SesionUsuario = {
  usuarioId: number;
  usuario: string;
  rol: RolUsuario;
  colegioId?: string | null;
  modulos?: string[];
};

function obtenerClaveSecreta() {
  const secreto = process.env.AUTH_SECRET || process.env.JWT_SECRET;

  if (!secreto || secreto.length < 32) {
    throw new Error(
      "AUTH_SECRET o JWT_SECRET no está configurado o tiene menos de 32 caracteres"
    );
  }

  return new TextEncoder().encode(secreto);
}

function esRolValido(valor: unknown): valor is RolUsuario {
  return (
    valor === "SUPER_ADMIN" ||
    valor === "ADMIN" ||
    valor === "ADMIN_COLEGIO" ||
    valor === "DIRECTIVO" ||
    valor === "DIRECTOR" ||
    valor === "DOCENTE" ||
    valor === "SECRETARIA" ||
    valor === "PORTERIA" ||
    valor === "DEMO" ||
    valor === "PERSONAL" ||
    valor === "PERSONALIZADO" ||
    valor === "PADRE"
  );
}

export async function crearTokenSesion(
  sesion: SesionUsuario
): Promise<string> {
  return new SignJWT({
    usuarioId: sesion.usuarioId,
    usuario: sesion.usuario,
    rol: sesion.rol,
    colegioId: sesion.colegioId ?? (sesion.rol === "SUPER_ADMIN" ? null : "SANTA_RITA_001"),
    modulos: sesion.modulos || [],
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(obtenerClaveSecreta());
}

export async function guardarSesion(
  sesion: SesionUsuario
): Promise<void> {
  const token = await crearTokenSesion(sesion);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function obtenerSesion(request?: Request): Promise<SesionUsuario | null> {
  try {
    let token: string | undefined;

    if (request) {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = match[1];
      }
      if (!token) {
        const authHeader = request.headers.get("authorization") || "";
        if (authHeader.startsWith("Bearer ")) {
          token = authHeader.slice(7).trim();
        }
      }
    }

    if (!token && !request) {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    }

    if (!token) {
      return null;
    }

    const resultado = await jwtVerify(
      token,
      obtenerClaveSecreta()
    );

    const usuarioId = Number(
      resultado.payload.usuarioId
    );

    const usuario = String(
      resultado.payload.usuario || ""
    ).trim();

    const rol = String(
      resultado.payload.rol || ""
    ).toUpperCase();

    if (
      !Number.isInteger(usuarioId) ||
      usuarioId <= 0 ||
      !usuario ||
      !esRolValido(rol)
    ) {
      return null;
    }

    const colegioIdRaw = resultado.payload.colegioId;
    const colegioId =
      colegioIdRaw === null
        ? null
        : typeof colegioIdRaw === "string"
        ? colegioIdRaw
        : "SANTA_RITA_001";

    const modulosRaw = (resultado.payload as any).modulos;
    const modulos: string[] = Array.isArray(modulosRaw) ? (modulosRaw as string[]) : [];

    return {
      usuarioId,
      usuario,
      rol,
      colegioId,
      modulos,
    };
  } catch (error) {
    console.error(
      "Error verificando sesión:",
      error
    );

    return null;
  }
}

export async function eliminarSesion(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

function respuestaNoAutenticado() {
  return Response.json(
    {
      ok: false,
      message: "No autenticado",
    },
    {
      status: 401,
    }
  );
}

function respuestaNoAutorizado() {
  return Response.json(
    {
      ok: false,
      message:
        "No tiene permisos para realizar esta acción",
    },
    {
      status: 403,
    }
  );
}

export async function exigirSesion(request?: Request) {
  const sesion = await obtenerSesion(request);

  if (!sesion) {
    return {
      autorizado: false as const,
      respuesta: respuestaNoAutenticado(),
    };
  }

  return {
    autorizado: true as const,
    sesion,
  };
}

export async function exigirRoles(
  rolesPermitidos: RolUsuario[],
  request?: Request
) {
  const acceso = await exigirSesion(request);

  if (!acceso.autorizado) {
    return acceso;
  }

  if (
    !rolesPermitidos.includes(
      acceso.sesion.rol
    )
  ) {
    return {
      autorizado: false as const,
      respuesta: respuestaNoAutorizado(),
    };
  }

  return acceso;
}

export async function exigirAdmin(request?: Request) {
  return exigirRoles(["SUPER_ADMIN", "ADMIN", "ADMIN_COLEGIO"], request);
}

export async function exigirSuperAdmin(request?: Request) {
  return exigirRoles(["SUPER_ADMIN"], request);
}

export async function exigirDirector(request?: Request) {
  return exigirRoles(["SUPER_ADMIN", "ADMIN", "ADMIN_COLEGIO", "DIRECTOR", "DIRECTIVO"], request);
}

export async function exigirAdminODemo(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DEMO",
  ], request);
}

export async function exigirPersonal(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "PERSONAL",
  ], request);
}

export async function exigirAdminOPersonal(request?: Request) {
  if (request) {
    // 1. Validar si la solicitud proviene de una Terminal Registrada (Criptográfica SHA-256)
    const validacionTerminal = await validarTerminalRequest(request);
    if (validacionTerminal !== null) {
      if (validacionTerminal.autorizado) {
        return {
          autorizado: true as const,
          sesion: validacionTerminal.sesion,
        };
      }

      return {
        autorizado: false as const,
        respuesta: Response.json(
          {
            ok: false,
            message: validacionTerminal.motivo || "Terminal no autorizada",
          },
          {
            status: validacionTerminal.status,
          }
        ),
      };
    }
  }

  // 2. Validar sesión autenticada de usuario (Cookie / JWT Bearer)
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DIRECTIVO",
    "DIRECTOR",
    "PERSONAL",
  ], request);
}

export async function exigirCualquierRol(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DIRECTIVO",
    "DIRECTOR",
    "DEMO",
    "PERSONAL",
    "PADRE",
  ], request);
}

export async function exigirAdminDemoOPersonal(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DIRECTIVO",
    "DIRECTOR",
    "DEMO",
    "PERSONAL",
  ], request);
}

export async function exigirAdminODirectivo(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DIRECTIVO",
    "DIRECTOR",
  ], request);
}

export async function exigirAdminDirectivoODemo(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DIRECTIVO",
    "DIRECTOR",
    "DEMO",
  ], request);
}

export async function exigirAdminDirectivoDemoOPersonal(request?: Request) {
  return exigirRoles([
    "SUPER_ADMIN",
    "ADMIN",
    "ADMIN_COLEGIO",
    "DIRECTIVO",
    "DIRECTOR",
    "DEMO",
    "PERSONAL",
  ], request);
}
export async function exigirPermisoModulo(moduloId: string, request?: Request) {
  const acceso = await exigirSesion(request);
  if (!acceso.autorizado) {
    return acceso;
  }

  const { rol, modulos } = acceso.sesion;

  // Los administradores principales tienen acceso completo
  if (rol === "SUPER_ADMIN" || rol === "ADMIN" || rol === "ADMIN_COLEGIO") {
    return acceso;
  }

  // Comprobar si el módulo está explícitamente en los autorizados o en la plantilla del rol
  const permitidos = modulos && modulos.length > 0 ? modulos : obtenerModulosPorRol(rol);

  if (!permitidos.includes(moduloId)) {
    return {
      autorizado: false as const,
      respuesta: Response.json(
        {
          ok: false,
          message: `No tiene permisos para acceder al módulo "${moduloId}"`,
        },
        {
          status: 403,
        }
      ),
    };
  }

  return acceso;
}
