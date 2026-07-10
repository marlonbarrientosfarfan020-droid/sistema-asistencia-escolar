"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `block px-4 py-3 rounded-xl ${
      pathname === href ? "bg-blue-600" : "hover:bg-slate-800"
    }`;

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

    let temporizador: NodeJS.Timeout;

    const cerrarPorInactividad = () => {
      localStorage.removeItem("logueado");
      localStorage.removeItem("rol");
      localStorage.removeItem("usuario");

      alert("Sesión cerrada por inactividad");

      router.replace("/login");
    };

    const reiniciarTemporizador = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(cerrarPorInactividad, 20 * 60 * 1000);
    };

    const eventos = ["mousemove", "keydown", "click", "scroll"];

    window.addEventListener("popstate", bloquearAtras);

    eventos.forEach((evento) => {
      window.addEventListener(evento, reiniciarTemporizador);
    });

    reiniciarTemporizador();

    return () => {
      window.removeEventListener("popstate", bloquearAtras);

      eventos.forEach((evento) => {
        window.removeEventListener(evento, reiniciarTemporizador);
      });

      clearTimeout(temporizador);
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
              <p className="font-bold text-lg">{usuario || "Administrador"}</p>
              <p className="text-slate-400 text-sm">{rol}</p>
            </div>
          </div>
        </div>

        <nav className="mt-10 space-y-3">
          <a href="/dashboard" className={linkClass("/dashboard")}>
            🏠 Dashboard
          </a>

          <a
            href="/dashboard/estudiantes"
            className={linkClass("/dashboard/estudiantes")}
          >
            👨‍🎓 Estudiantes
          </a>

          <a
            href="/dashboard/asistencias"
            className={linkClass("/dashboard/asistencias")}
          >
            📅 Asistencias
          </a>
          

          <a
            href="/dashboard/reportes-mensuales"
            className={linkClass("/dashboard/reportes-mensuales")}
          >
            📊 Reportes mensuales
          </a>

          <a
            href="/dashboard/reporte-estudiante"
            className={linkClass("/dashboard/reporte-estudiante")}
          >
            👨‍🎓 Reporte estudiante
          </a>
         <a
  href="/dashboard/inteligencia"
  className={linkClass("/dashboard/inteligencia")}
>
  🧠 Inteligencia Escolar
</a>
<a
  href="/dashboard/inteligencia/historial"
  className={linkClass("/dashboard/inteligencia/historial")}
>
  📚 Historial IA
</a>
<a
  href="/dashboard/inteligencia/ranking"
  className={linkClass("/dashboard/inteligencia/ranking")}
>
  🔥 Ranking IA
</a>

          {rol === "ADMIN" && (
            <a
              href="/dashboard/usuarios"
              className={linkClass("/dashboard/usuarios")}
            >
              👤 Usuarios
            </a>
          )}

          <a
            href="/marcar"
            className={
              pathname === "/marcar"
                ? "block bg-blue-600 px-4 py-3 rounded-xl"
                : "block px-4 py-3 rounded-xl hover:bg-slate-800"
            }
          >
            📷 Marcar asistencia
          </a>

          <a href="/dashboard/turnos" className={linkClass("/dashboard/turnos")}>
            ⏰ Turnos
          </a>

          <a
            href="/dashboard/configuracion"
            className={linkClass("/dashboard/configuracion")}
          >
            ⚙️ Configuración
          </a>
          <a
  href="/dashboard/calendario"
  className={linkClass("/dashboard/calendario")}
>
  📅 Calendario escolar
</a>

          {rol === "ADMIN" && (
            <a href="/dashboard/backup" className={linkClass("/dashboard/backup")}>
              💾 Backup
            </a>
            
          )}

          

          {rol === "ADMIN" && (
            <a
              href="/dashboard/auditoria"
              className={linkClass("/dashboard/auditoria")}
            >
              🧾 Auditoría
            </a>
          )}
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

          <p className="text-xs text-slate-500 mt-3">Versión 1.0</p>

          <p className="text-xs text-blue-400 mt-4 font-semibold">
            Desarrollado por
          </p>

          <p className="text-sm font-bold text-white">Ing. de Sistemas</p>

          <p className="text-sm font-bold text-blue-400">
            Marlon Barrientos Farfán
          </p>
        </div>
      </aside>

      <section className="flex-1 p-10">{children}</section>
    </main>
  );
}