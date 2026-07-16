import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "sesion_santa_rita";

export type RolUsuario =
  | "ADMIN"
  | "DIRECTIVO"
  | "DEMO"
  | "PERSONAL";

export type SesionUsuario = {
  usuarioId: number;
  usuario: string;
  rol: RolUsuario;
};

function obtenerClaveSecreta() {
  const secreto = process.env.AUTH_SECRET;

  if (!secreto || secreto.length < 32) {
    throw new Error(
      "AUTH_SECRET no está configurado o tiene menos de 32 caracteres"
    );
  }

  return new TextEncoder().encode(secreto);
}

function esRolValido(valor: unknown): valor is RolUsuario {
  return (
    valor === "ADMIN" ||
    valor === "DIRECTIVO" ||
    valor === "DEMO" ||
    valor === "PERSONAL"
  );
}

export async function crearTokenSesion(
  sesion: SesionUsuario
): Promise<string> {
  return new SignJWT({
    usuarioId: sesion.usuarioId,
    usuario: sesion.usuario,
    rol: sesion.rol,
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

export async function obtenerSesion(): Promise<SesionUsuario | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

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

    return {
      usuarioId,
      usuario,
      rol,
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

export async function exigirSesion() {
  const sesion = await obtenerSesion();

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
  rolesPermitidos: RolUsuario[]
) {
  const acceso = await exigirSesion();

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

export async function exigirAdmin() {
  return exigirRoles(["ADMIN"]);
}

export async function exigirAdminODemo() {
  return exigirRoles([
    "ADMIN",
    "DEMO",
  ]);
}

export async function exigirPersonal() {
  return exigirRoles([
    "PERSONAL",
  ]);
}

export async function exigirAdminOPersonal() {
  return exigirRoles([
    "ADMIN",
    "PERSONAL",
  ]);
}

export async function exigirCualquierRol() {
  return exigirRoles([
    "ADMIN",
    "DIRECTIVO",
    "DEMO",
    "PERSONAL",
  ]);
}
export async function exigirAdminDemoOPersonal() {
  return exigirRoles([
    "ADMIN",
    "DEMO",
    "PERSONAL",
  ]);
}
export async function exigirAdminODirectivo() {
  return exigirRoles([
    "ADMIN",
    "DIRECTIVO",
  ]);
}

export async function exigirAdminDirectivoODemo() {
  return exigirRoles([
    "ADMIN",
    "DIRECTIVO",
    "DEMO",
  ]);
}

export async function exigirAdminDirectivoDemoOPersonal() {
  return exigirRoles([
    "ADMIN",
    "DIRECTIVO",
    "DEMO",
    "PERSONAL",
  ]);
}