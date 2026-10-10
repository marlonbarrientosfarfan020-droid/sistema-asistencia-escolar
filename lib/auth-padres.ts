import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const COOKIE_PADRE_NAME = "sesion_padre_santa_rita";
export const VERSION_SESION_ACTUAL = 2; // Invalida cualquier sesi�n previa a la correcci�n

export type SesionPadre = {
  codigoFamiliarId: number;
  codigoFamiliar: string;
  tutorTitular: string;
  estudianteAutorizadoId: number;
  estudiantesPermitidosIds: number[];
  colegioId: string;
  versionSesion: number;
};

function obtenerClaveSecreta() {
  const secreto = process.env.AUTH_SECRET;

  if (!secreto || secreto.length < 32) {
    throw new Error(
      "AUTH_SECRET no est� configurado o tiene menos de 32 caracteres"
    );
  }

  return new TextEncoder().encode(secreto);
}

export async function crearTokenSesionPadre(sesion: SesionPadre): Promise<string> {
  return new SignJWT({
    codigoFamiliarId: sesion.codigoFamiliarId,
    codigoFamiliar: sesion.codigoFamiliar,
    tutorTitular: sesion.tutorTitular,
    estudianteAutorizadoId: sesion.estudianteAutorizadoId,
    estudiantesPermitidosIds: sesion.estudiantesPermitidosIds,
    colegioId: sesion.colegioId,
    versionSesion: sesion.versionSesion || VERSION_SESION_ACTUAL,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(obtenerClaveSecreta());
}

export async function guardarSesionPadre(sesion: SesionPadre): Promise<void> {
  const token = await crearTokenSesionPadre({
    ...sesion,
    versionSesion: VERSION_SESION_ACTUAL,
  });
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_PADRE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 d�as
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
        // En entornos fuera del contexto de petici�n nativo de Next.js
      }
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, obtenerClaveSecreta());

    // REGLA DE SEGURIDAD ESTRICTA: Invalidar cualquier sesi�n anterior que no tenga versionSesion === 2
    // o que carezca de estudianteAutorizadoId v�lido
    const versionSesion = Number(payload.versionSesion || 0);
    const estudianteAutorizadoId = Number(payload.estudianteAutorizadoId || 0);

    if (versionSesion < VERSION_SESION_ACTUAL || !estudianteAutorizadoId) {
      return null; // Sesi�n previa revocada por seguridad
    }

    const codigoFamiliarId = Number(payload.codigoFamiliarId);
    const codigoFamiliar = String(payload.codigoFamiliar || "");
    const tutorTitular = String(payload.tutorTitular || "");
    const estudiantesPermitidosIds = Array.isArray(payload.estudiantesPermitidosIds)
      ? payload.estudiantesPermitidosIds.map(Number)
      : [estudianteAutorizadoId];
    const colegioId = String(payload.colegioId || "SANTA_RITA_001");

    if (!codigoFamiliarId || !codigoFamiliar) return null;

    return {
      codigoFamiliarId,
      codigoFamiliar,
      tutorTitular,
      estudianteAutorizadoId,
      estudiantesPermitidosIds,
      colegioId,
      versionSesion,
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
        {
          ok: false,
          message: "Sesi�n familiar expirada, desactualizada o revocada por seguridad. Inicie sesi�n nuevamente.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    autorizado: true as const,
    sesion,
  };
}
