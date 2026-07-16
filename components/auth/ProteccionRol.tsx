"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type RolUsuario =
  | "ADMIN"
  | "DIRECTIVO"
  | "DEMO"
  | "PERSONAL";

type Props = {
  rolesPermitidos: RolUsuario[];
  children: React.ReactNode;
};

export default function ProteccionRol({
  rolesPermitidos,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [verificando, setVerificando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let componenteActivo = true;

    async function verificarPermiso() {
      try {
        const respuesta = await fetch(
          "/api/auth/sesion",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (respuesta.status === 401) {
          router.replace(
            `/login?retorno=${encodeURIComponent(pathname)}`
          );
          return;
        }

        const data = await respuesta.json();

        const rol = String(
          data?.usuario?.rol || ""
        ).toUpperCase() as RolUsuario;

        if (!rolesPermitidos.includes(rol)) {
          router.replace(
            `/dashboard/acceso-denegado?desde=${encodeURIComponent(
              pathname
            )}`
          );
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

        router.replace("/login");
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
  }, [pathname, rolesPermitidos, router]);

  if (verificando) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="rounded-3xl border border-blue-200 bg-white px-8 py-7 text-center shadow-lg">
          <div className="text-4xl">🔐</div>

          <p className="mt-4 text-lg font-black text-slate-900">
            Verificando permisos
          </p>

          <p className="mt-1 text-sm text-slate-500">
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