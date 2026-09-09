import { SesionUsuario } from "./auth";

export const DEFAULT_COLEGIO_ID = "SANTA_RITA_001";

export interface TenantContext {
  colegioId: string;
  esSuperAdmin: boolean;
  usuario: string;
  rol: string;
}

/**
 * Resuelve y valida el colegio activo para una solicitud en curso.
 * Garantiza el aislamiento estricto de datos entre instituciones:
 * - SUPER_ADMIN: Puede gestionar todos los colegios y seleccionar uno mediante x-colegio-id o query params.
 * - ADMIN_COLEGIO / DIRECTOR / PERSONAL / PADRE: Limitados estrictamente a su colegio asignado.
 */
export function resolverColegio(
  sesion?: SesionUsuario | null,
  request?: Request
): { ok: true; context: TenantContext } | { ok: false; status: number; message: string } {
  if (!sesion) {
    // Si no hay sesión, se utiliza el colegio predeterminado sólo si es una ruta pública o terminal
    return {
      ok: true,
      context: {
        colegioId: DEFAULT_COLEGIO_ID,
        esSuperAdmin: false,
        usuario: "ANONIMO",
        rol: "INVITADO",
      },
    };
  }

  const esSuperAdmin = sesion.rol === "SUPER_ADMIN";
  const colegioAsignado = sesion.colegioId || DEFAULT_COLEGIO_ID;

  // Extraer posible colegio solicitado por header o query
  let colegioSolicitado: string | null = null;
  if (request) {
    const url = new URL(request.url);
    colegioSolicitado =
      request.headers.get("x-colegio-id")?.trim() ||
      url.searchParams.get("colegioId")?.trim() ||
      null;
  }

  // Si es SUPER_ADMIN, puede seleccionar cualquier colegio
  if (esSuperAdmin) {
    return {
      ok: true,
      context: {
        colegioId: colegioSolicitado || colegioAsignado,
        esSuperAdmin: true,
        usuario: sesion.usuario,
        rol: sesion.rol,
      },
    };
  }

  // Para cualquier otro rol, si solicita explícitamente otro colegio, se RECHAZA con 403
  if (colegioSolicitado && colegioSolicitado !== colegioAsignado) {
    return {
      ok: false,
      status: 403,
      message: `Acceso denegado: No tiene autorización para acceder a los datos de la institución ${colegioSolicitado}`,
    };
  }

  // Devolver el colegio asignado estrictamente al usuario
  return {
    ok: true,
    context: {
      colegioId: colegioAsignado,
      esSuperAdmin: false,
      usuario: sesion.usuario,
      rol: sesion.rol,
    },
  };
}

/**
 * Valida si una sesión tiene permiso para operar en el colegio especificado.
 */
export function validarAccesoColegio(
  sesion: SesionUsuario,
  targetColegioId: string
): boolean {
  if (sesion.rol === "SUPER_ADMIN") return true;
  const asignado = sesion.colegioId || DEFAULT_COLEGIO_ID;
  return asignado === targetColegioId;
}
