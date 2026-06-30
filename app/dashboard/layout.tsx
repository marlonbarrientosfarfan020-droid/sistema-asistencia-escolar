"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
 const [rol, setRol] = useState("");
const [usuario, setUsuario] = useState("");

  useEffect(() => {
    const logueado = localStorage.getItem("logueado");
    const rolGuardado = localStorage.getItem("rol");
    const usuarioGuardado = localStorage.getItem("usuario");

    if (logueado !== "true") {
      router.replace("/login");
      return;
    }

  if (rolGuardado === "PERSONAL") {
  router.replace("/marcar");
  return;
}

    setRol(rolGuardado || "");
    setUsuario(usuarioGuardado || "");
    window.history.pushState(null, "", window.location.href);

const bloquearAtras = () => {
  window.history.pushState(null, "", window.location.href);
};

window.addEventListener("popstate", bloquearAtras);

return () => {
  window.removeEventListener("popstate", bloquearAtras);
};
  }, [router]);

  function cerrarSesion() {
    localStorage.removeItem("logueado");
    localStorage.removeItem("rol");
    localStorage.removeItem("usuario");
    window.history.replaceState(null, "", "/login");
router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 flex">
      <aside className="w-72 bg-slate-950 text-white p-6">
        <div className="text-center">
  <Image
    src="/img/logo-santa-rita.png"
    alt="Logo Santa Rita"
    width={90}
    height={90}
    className="mx-auto bg-white rounded-2xl p-2"
  />

  <h1 className="text-xl font-bold mt-4">
    I.E. Santa Rita de Casia
  </h1>

  <p className="text-slate-400 mt-1 text-sm">
    Sistema de Asistencia
  </p>
</div>

<div className="mt-6 bg-slate-900 rounded-2xl p-4 border border-slate-700">
  <div className="flex items-center gap-3">
    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
      👤
    </div>

    <div>
      <p className="font-bold text-lg">
        {usuario || "Administrador"}
      </p>

      <p className="text-slate-400 text-sm">
        {rol}
      </p>
    </div>
  </div>
</div>

        <nav className="mt-10 space-y-3">
          
          <a href="/dashboard" className="block bg-blue-600 px-4 py-3 rounded-xl">
            🏠 Dashboard
          </a>

          <a href="/dashboard/estudiantes" className="block px-4 py-3 rounded-xl hover:bg-slate-800">
            👨‍🎓 Estudiantes
          </a>

          <a href="/dashboard/asistencias" className="block px-4 py-3 rounded-xl hover:bg-slate-800">
            📅 Asistencias
          </a>
           <a href="/dashboard/usuarios" className="block px-4 py-3 rounded-xl hover:bg-slate-800">
    👤 Usuarios
  </a>

          <a href="/marcar" className="block px-4 py-3 rounded-xl hover:bg-slate-800">
            📷 Marcar asistencia
          </a>
          <a
  href="/dashboard/configuracion"
  className="block px-4 py-3 rounded-xl hover:bg-slate-800"
>
  ⚙️ Configuración
</a>
        </nav>

        <button
          onClick={cerrarSesion}
          className="mt-10 w-full bg-red-600 hover:bg-red-700 px-4 py-3 rounded-xl font-bold"
        >
          🚪 Cerrar sesión
        </button>
        <div className="mt-10 border-t border-slate-700 pt-6 text-center">
  <p className="text-xs text-slate-400">
    Sistema de Control de Asistencia
  </p>

  <p className="text-xs text-slate-500 mt-1">
    I.E. Santa Rita de Casia
  </p>

  <p className="text-xs text-slate-500 mt-3">
    Versión 1.0
  </p>

  <p className="text-xs text-blue-400 mt-4 font-semibold">
    Desarrollado por
  </p>

  <p className="text-sm font-bold text-white">
    Ing. de Sistemas
  </p>

  <p className="text-sm font-bold text-blue-400">
    Marlon Barrientos Farfán
  </p>
</div>
      </aside>

      <section className="flex-1 p-10">{children}</section>
    </main>
  );
}