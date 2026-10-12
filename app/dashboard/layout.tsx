"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";
import {
  CATEGORIAS_MODULOS,
  MODULOS_POR_CATEGORIA,
  obtenerModulosPorRol,
  esRutaPermitida,
} from "@/lib/modulos";

type MenuItem = {
  href: string;
  icono: string;
  texto: string;
  visible: boolean;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { configuracion } = useConfiguracionColegio();

  const [rol, setRol] = useState("");
  const [usuario, setUsuario] = useState("");
  const [modulosPermitidos, setModulosPermitidos] = useState<string[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cargandoAuth, setCargandoAuth] = useState(true);

  const esAdmin = rol === "ADMIN";
  const esDemo = rol === "DEMO";
  const esPersonal = rol === "PERSONAL";
  const esDirectivo = rol === "DIRECTIVO" || rol === "DIRECTOR";

  const puedeGestionar =
    esAdmin || esDirectivo || esDemo || esPersonal;

  const puedeAnalizar =
    esAdmin || esDirectivo || esDemo;

  const puedeAdministrar =
    esAdmin || esDirectivo;

  const linkClass = (href: string) => {
    const activo =
      pathname === href ||
      (href !== "/dashboard" &&
        pathname.startsWith(`${href}/`));

    return `flex items-center gap-3 rounded-xl px-4 py-3 font-semibold transition ${
      activo
        ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
        : "text-slate-200 hover:bg-slate-800 hover:text-white"
    }`;
  };

  useEffect(() => {
    const logueado = localStorage.getItem("logueado");
    const rolGuardado = localStorage.getItem("rol");
    const usuarioGuardado = localStorage.getItem("usuario");
    const modulosGuardados = localStorage.getItem("modulos");

    if (logueado !== "true") {
      router.replace("/login");
      return;
    }

    setRol(rolGuardado || "");
    setUsuario(usuarioGuardado || "");

    let mods: string[] = [];
    if (modulosGuardados) {
      try {
        mods = JSON.parse(modulosGuardados);
      } catch {
        mods = [];
      }
    }
    if (!Array.isArray(mods) || mods.length === 0) {
      mods = obtenerModulosPorRol(rolGuardado || "");
    }
    setModulosPermitidos(mods);
    setCargandoAuth(false);

    // Sincronizar en segundo plano con la sesión del servidor para revocaciones inmediatas
    fetch("/api/auth/sesion", { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.usuario?.modulos && Array.isArray(data.usuario.modulos)) {
          setModulosPermitidos(data.usuario.modulos);
          localStorage.setItem("modulos", JSON.stringify(data.usuario.modulos));
        }
      })
      .catch(() => {});

    window.history.pushState(null, "", window.location.href);

    const bloquearAtras = () => {
      window.history.pushState(null, "", window.location.href);
    };

    let temporizador: ReturnType<typeof setTimeout>;

    const cerrarPorInactividad = async () => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
        });
      } finally {
        alert("Sesión cerrada por inactividad");
        window.location.replace("/login");
      }
    };

    const reiniciarTemporizador = () => {
      clearTimeout(temporizador);

      temporizador = setTimeout(
        cerrarPorInactividad,
        20 * 60 * 1000
      );
    };

    const eventos = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];

    window.addEventListener("popstate", bloquearAtras);

    eventos.forEach((evento) => {
      window.addEventListener(evento, reiniciarTemporizador);
    });

    reiniciarTemporizador();

    return () => {
      window.removeEventListener("popstate", bloquearAtras);

      eventos.forEach((evento) => {
        window.removeEventListener(
          evento,
          reiniciarTemporizador
        );
      });

      clearTimeout(temporizador);
    };
  }, [router]);

// Protección de rutas: redirige a acceso denegado si no tiene permiso
  useEffect(() => {
    if (cargandoAuth) return;
    if (pathname === "/dashboard/acceso-denegado" || pathname === "/login") return;

    const permitida = esRutaPermitida(pathname, modulosPermitidos, esAdmin);
    if (!permitida) {
      console.warn(`[RouteGuard] Acceso denegado para ${usuario} en ruta: ${pathname}`);
      router.replace("/dashboard/acceso-denegado");
    }
  }, [pathname, modulosPermitidos, esAdmin, cargandoAuth, usuario, router]);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuAbierto ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  async function cerrarSesion() {
    try {
      localStorage.clear();
      sessionStorage.clear();

      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      window.location.replace("/login");
    }
  }

  function GrupoMenu({
    titulo,
    items,
  }: {
    titulo: string;
    items: MenuItem[];
  }) {
    const visibles = items.filter((item) => item.visible);

    if (visibles.length === 0) {
      return null;
    }

    return (
      <div>
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          {titulo}
        </p>

        <div className="space-y-1">
          {visibles.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900/70 text-base">
                {item.icono}
              </span>

              <span className="min-w-0 flex-1">
                {item.texto}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  function Sidebar() {
    // Menú dinámico centralizado generado desde MODULOS_POR_CATEGORIA

    return (
      <div className="flex min-h-full flex-col">
        <div className="text-center">
          {configuracion.logoUrl ? (
            <img
              src={configuracion.logoUrl}
              key={configuracion.logoUrl}
              alt={`Logo de ${configuracion.nombreColegio}`}
              className="mx-auto h-[78px] w-[78px] rounded-2xl bg-white object-contain p-2 shadow-lg"
            />
          ) : (
            <Image
              src="/img/logo-santa-rita.png"
              alt="Logo institucional"
              width={78}
              height={78}
              className="mx-auto rounded-2xl bg-white p-2 shadow-lg"
              priority
            />
          )}

          <h1 className="mt-4 text-lg font-black leading-tight">
            {configuracion.nombreColegio}
          </h1>

          <p className="mt-1 text-xs text-slate-400">
            Sistema de Asistencia
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold">
              👤
            </div>

            <div className="min-w-0">
              <p className="truncate font-bold">
                {usuario || "Administrador"}
              </p>

              <p className="text-xs text-slate-400">
                {rol || "USUARIO"}
              </p>
            </div>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-6">
          {CATEGORIAS_MODULOS.map((categoria) => {
            const modulosDeCategoria = MODULOS_POR_CATEGORIA[categoria] || [];
            const items: MenuItem[] = modulosDeCategoria.map((mod) => ({
              href: mod.ruta,
              icono: mod.icono,
              texto: mod.nombre,
              visible: esAdmin || modulosPermitidos.includes(mod.id),
            }));

            return (
              <GrupoMenu
                key={categoria}
                titulo={categoria}
                items={items}
              />
            );
          })}

          {esDemo && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
              🧪 Modo demo: solo visualización
            </div>
          )}

          {esDirectivo && (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              👔 Directivo: panel estratégico y análisis institucional
            </div>
          )}

          {rol === "PORTERIA" && (
            <div className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-200">
              🚪 Portería: control de ingresos y salidas
            </div>
          )}

          {rol === "DOCENTE" && (
            <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200">
              📚 Docente: gestión de aula y asistencia
            </div>
          )}

          {rol === "SECRETARIA" && (
            <div className="rounded-xl border border-teal-400/40 bg-teal-500/10 px-4 py-3 text-sm font-semibold text-teal-200">
              📋 Secretaría: administración escolar y reportes
            </div>
          )}
        </nav>

        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold transition hover:bg-red-700"
        >
          <span>🚪</span>
          <span>Cerrar sesión</span>
        </button>

        <div className="mt-8 border-t border-slate-700 pt-5 text-center">
          <p className="text-xs text-slate-400">
            Sistema de Control de Asistencia
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {configuracion.nombreColegio}
          </p>

          <p className="mt-3 text-xs text-slate-500">
            Versión 1.0
          </p>

          <p className="mt-4 text-xs font-semibold text-blue-400">
            Desarrollado por
          </p>

          <p className="text-sm font-bold text-white">
            Ing. de Sistemas
          </p>

          <p className="text-sm font-bold text-blue-400">
            Marlon Barrientos Farfán
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 lg:flex">
      {/* MENÚ DE COMPUTADORA */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto bg-slate-950 p-6 text-white lg:block">
        <Sidebar />
      </aside>

      {/* FONDO OSCURO DEL MENÚ MÓVIL */}
      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* MENÚ MÓVIL */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[82%] max-w-[310px] overflow-y-auto bg-slate-950 p-5 text-white shadow-2xl transition-transform duration-300 lg:hidden ${
          menuAbierto
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-xl hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        <Sidebar />
      </aside>

      {/* CONTENIDO */}
      <div className="min-w-0 flex-1 lg:ml-72">
        {/* BARRA SUPERIOR DEL CELULAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 font-bold text-white"
          >
            <span className="text-xl">☰</span>
            Menú
          </button>

          <div className="flex min-w-0 items-center gap-2">
            {configuracion.logoUrl ? (
              <img
                src={configuracion.logoUrl}
                alt="Logo institucional"
                className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 shadow"
              />
            ) : (
              <Image
                src="/img/logo-santa-rita.png"
                alt="Logo institucional"
                width={40}
                height={40}
                className="shrink-0 rounded-xl bg-white p-1 shadow"
              />
            )}

            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-black text-slate-900">
                {configuracion.nombreColegio}
              </p>

              <p className="text-xs text-slate-500">
                Panel administrativo
              </p>
            </div>
          </div>
        </header>

        <section className="min-w-0 p-0">
          {children}
        </section>
      </div>
    </main>
  );
}