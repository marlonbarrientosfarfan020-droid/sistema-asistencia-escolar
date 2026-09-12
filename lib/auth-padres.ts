import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const COOKIE_PADRE_NAME = "sesion_padre_santa_rita";

export type SesionPadre = {
  codigoFamiliarId: number;
  codigoFamiliar: string;
  tutorTitular: string;
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

export async function crearTokenSesionPadre(sesion: SesionPadre): Promise<string> {
  return new SignJWT({
    codigoFamiliarId: sesion.codigoFamiliarId,
    codigoFamiliar: sesion.codigoFamiliar,
    tutorTitular: sesion.tutorTitular,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(obtenerClaveSecreta());
}

export async function guardarSesionPadre(sesion: SesionPadre): Promise<void> {
  const token = await crearTokenSesionPadre(sesion);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_PADRE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
}

export async function obtenerSesionPadre(request?: Request): Promise<SesionPadre | null> {
  try {
    let token: string | undefined;

    if (request) {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`${COOKIE_PADRE_NAME}=([^;]+)`));
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

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(COOKIE_PADRE_NAME)?.value;
      } catch {
        // En entornos fuera del contexto de petición nativo de Next.js
      }
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, obtenerClaveSecreta());

    const codigoFamiliarId = Number(payload.codigoFamiliarId);
    const codigoFamiliar = String(payload.codigoFamiliar || "");
    const tutorTitular = String(payload.tutorTitular || "");

    if (!codigoFamiliarId || !codigoFamiliar) return null;

    return {
      codigoFamiliarId,
      codigoFamiliar,
      tutorTitular,
    };
  } catch {
    return null;
  }
}

export async function destruirSesionPadre(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_PADRE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function exigirSesionPadre(request?: Request) {
  const sesion = await obtenerSesionPadre(request);

  if (!sesion) {
    return {
      autorizado: false as const,
      respuesta: NextResponse.json(
        { ok: false, message: "Sesión de padre de familia expirada o no válida" },
        { status: 401 }
      ),
    };
  }

  return {
    autorizado: true as const,
    sesion,
  };
}
