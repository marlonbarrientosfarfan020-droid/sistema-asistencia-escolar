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
  const secreto = process.env.AUTH_SECRET || "santa_rita_de_cassia_cañete_secret_key_2026_super_secure";
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

export async function obtenerSesionPadre(): Promise<SesionPadre | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_PADRE_NAME)?.value;

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

export async function exigirSesionPadre() {
  const sesion = await obtenerSesionPadre();

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
