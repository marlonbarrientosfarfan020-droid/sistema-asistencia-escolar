"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type LoginResponse = {
  ok?: boolean;
  message?: string;
  usuario?: {
    id: number;
    nombre: string;
    rol: string;
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [modalOlvido, setModalOlvido] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const logueado = localStorage.getItem("logueado");
    const rol = localStorage.getItem("rol");

    if (logueado === "true") {
      router.replace(rol === "PERSONAL" ? "/marcar" : "/dashboard");
    }
  }, [router]);

  async function ingresar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!usuario.trim() || !password.trim()) {
      setError("Ingrese usuario y contraseña");
      return;
    }

    setCargando(true);

    try {
      const respuesta = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          usuario: usuario.trim(),
          password,
        }),
      });

      const data = (await respuesta.json()) as LoginResponse;

      if (!respuesta.ok) {
        setError(data.message || "Error al iniciar sesión");
        return;
      }

      if (!data.usuario) {
        setError("El servidor no devolvió los datos del usuario");
        return;
      }

      const rol = String(data.usuario.rol || "").toUpperCase();

      localStorage.setItem("logueado", "true");
      localStorage.setItem("usuario", data.usuario.nombre);
      localStorage.setItem("rol", rol);

      if (rol === "PERSONAL") {
        router.replace("/marcar");
      } else {
        router.replace("/dashboard");
      }

      router.refresh();
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setError("No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 py-6"
      style={{
        backgroundImage: "url('/img/colegio-santa-rita.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/50" />

      <form
        onSubmit={ingresar}
        className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-7 sm:p-8 w-full max-w-md mx-auto border border-white/40"
      >
        <div className="text-center mb-6">
          <Image
            src="/img/logo-santa-rita.png"
            alt="Logo de la I.E. Santa Rita de Casia"
            width={105}
            height={105}
            className="mx-auto mb-4 bg-white rounded-2xl p-2 shadow"
            priority
          />

          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
            Sistema Inteligente de Asistencia Escolar
          </h1>

          <p className="text-slate-500 mt-2 font-semibold">
            I.E. Santa Rita de Casia
          </p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-sm font-bold">
            {error}
          </div>
        )}

        <label
          htmlFor="usuario"
          className="font-bold text-slate-700 text-sm"
        >
          Usuario
        </label>

        <div className="relative mb-4 mt-1">
          <span className="absolute left-3 top-3">👤</span>

          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ingrese su usuario"
            autoComplete="username"
            disabled={cargando}
            className="border rounded-xl p-3 pl-10 w-full text-base outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>

        <label
          htmlFor="password"
          className="font-bold text-slate-700 text-sm"
        >
          Contraseña
        </label>

        <div className="relative mb-3 mt-1">
          <span className="absolute left-3 top-3">🔒</span>

          <input
            id="password"
            type={mostrarPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingrese su contraseña"
            autoComplete="current-password"
            disabled={cargando}
            className="border rounded-xl p-3 pl-10 pr-12 w-full text-base outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />

          <button
            type="button"
            onClick={() => setMostrarPassword((valor) => !valor)}
            className="absolute right-3 top-3 text-slate-500"
            aria-label={
              mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
          >
            {mostrarPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <div className="text-right mb-6">
          <button
            type="button"
            onClick={() => setModalOlvido(true)}
            className="text-sm text-blue-700 font-bold hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="bg-blue-600 hover:bg-blue-700 text-white w-full py-3 rounded-xl font-bold disabled:opacity-50"
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="mt-8 pt-5 border-t border-slate-300 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Desarrollado por
          </p>

          <h3 className="mt-2 text-lg font-bold text-slate-800">
            Marlon Barrientos Farfán
          </h3>

          <p className="text-sm text-blue-700 font-semibold">
            Desarrollador de Software
          </p>

          <p className="mt-2 text-xs text-slate-400">Versión 1.0 © 2026</p>
        </div>
      </form>

      {modalOlvido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-7 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-3">
              Recuperar contraseña
            </h2>

            <p className="text-slate-600">
              Por seguridad, la contraseña debe ser restablecida por el
              administrador del sistema.
            </p>

            <div className="bg-blue-50 text-blue-800 rounded-xl p-4 mt-5 font-semibold">
              Comunícate con el administrador para que cambie tu contraseña
              desde el módulo de Usuarios.
            </div>

            <button
              type="button"
              onClick={() => setModalOlvido(false)}
              className="mt-6 bg-slate-900 text-white w-full py-3 rounded-xl font-bold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}