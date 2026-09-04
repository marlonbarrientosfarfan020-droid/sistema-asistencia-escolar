"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

type RolUsuario =
  | "ADMIN"
  | "DIRECTIVO"
  | "DEMO"
  | "PERSONAL";

type Props = {
  rolesPermitidos: RolUsuario[];
  children: React.ReactNode;
};

type RespuestaSesion = {
  autenticado?: boolean;
  usuario?: {
    id?: number;
    nombre?: string;
    rol?: string;
  } | null;
  message?: string;
};

export default function ProteccionRol({
  rolesPermitidos,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [verificando, setVerificando] =
    useState(true);

  const [autorizado, setAutorizado] =
    useState(false);

  /*
   * Evita ejecutar el efecto infinitamente cuando
   * el componente padre envía un arreglo literal:
   *
   * rolesPermitidos={[
   *   "ADMIN",
   *   "DIRECTIVO",
   *   "DEMO"
   * ]}
   */
  const claveRoles = useMemo(
    () =>
      [...rolesPermitidos]
        .sort()
        .join("|"),
    [rolesPermitidos]
  );

  useEffect(() => {
    let componenteActivo = true;

    async function verificarPermiso() {
      if (componenteActivo) {
        setVerificando(true);
        setAutorizado(false);
      }

      try {
        const respuesta = await fetch(
          "/api/auth/sesion",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
          }
        );

        const tipoContenido =
          respuesta.headers.get(
            "content-type"
          ) || "";

        if (
          !tipoContenido.includes(
            "application/json"
          )
        ) {
          const contenido =
            await respuesta.text();

          console.error(
            "La API de sesión no devolvió JSON:",
            {
              status: respuesta.status,
              contenido:
                contenido.slice(0, 200),
            }
          );

          throw new Error(
            "La ruta /api/auth/sesion no está disponible correctamente"
          );
        }

        const data =
          (await respuesta.json()) as RespuestaSesion;

        if (
          respuesta.status === 401 ||
          !data.autenticado
        ) {
          if (typeof window !== "undefined") {
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace(
              `/login?retorno=${encodeURIComponent(
                pathname
              )}`
            );
          }

          return;
        }

        if (!respuesta.ok) {
          throw new Error(
            data.message ||
              "No se pudo comprobar la sesión"
          );
        }

        const rol = String(
          data.usuario?.rol || ""
        ).toUpperCase() as RolUsuario;

        const listaPermitida =
          claveRoles.split(
            "|"
          ) as RolUsuario[];

        if (
          !listaPermitida.includes(rol)
        ) {
          if (componenteActivo) {
            router.replace(
              `/dashboard/acceso-denegado?desde=${encodeURIComponent(
                pathname
              )}`
            );
          }

          return;
        }

        if (componenteActivo) {
          setAutorizado(true);
        }
      } catch (error) {
        console.error(
          "Error comprobando permisos:",
          error
        );

        if (componenteActivo) {
          router.replace(
            `/login?retorno=${encodeURIComponent(
              pathname
            )}`
          );
        }
      } finally {
        if (componenteActivo) {
          setVerificando(false);
        }
      }
    }

    verificarPermiso();

    return () => {
      componenteActivo = false;
    };
  }, [
    pathname,
    router,
    claveRoles,
  ]);

  if (verificando) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950 p-6">
        <div className="rounded-3xl border border-blue-500/30 bg-slate-900 px-8 py-7 text-center shadow-2xl">
          <div className="text-4xl">
            🔐
          </div>

          <p className="mt-4 text-lg font-black text-white">
            Verificando permisos
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Espere un momento...
          </p>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return null;
  }

  return <>{children}</>;
}