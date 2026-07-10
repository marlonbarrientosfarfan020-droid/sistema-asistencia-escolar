import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "sesion_santa_rita";

export type RolUsuario = "ADMIN" | "DEMO";

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

    const usuarioId = Number(resultado.payload.usuarioId);
    const usuario = String(resultado.payload.usuario || "");
    const rol = String(resultado.payload.rol || "");

    if (
      !usuarioId ||
      !usuario ||
      (rol !== "ADMIN" && rol !== "DEMO")
    ) {
      return null;
    }

    return {
      usuarioId,
      usuario,
      rol,
    };
  } catch {
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

export async function exigirSesion() {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return {
      autorizado: false as const,
      respuesta: Response.json(
        {
          message: "No autenticado",
        },
        {
          status: 401,
        }
      ),
    };
  }

  return {
    autorizado: true as const,
    sesion,
  };
}

export async function exigirAdmin() {
  const acceso = await exigirSesion();

  if (!acceso.autorizado) {
    return acceso;
  }

  if (acceso.sesion.rol !== "ADMIN") {
    return {
      autorizado: false as const,
      respuesta: Response.json(
        {
          message: "No autorizado",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return acceso;
}

export async function exigirAdminODemo() {
  return exigirSesion();
}