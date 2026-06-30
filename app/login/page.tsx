"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [nombreColegio, setNombreColegio] = useState(
    "Sistema de Asistencia Escolar"
  );
  useEffect(() => {
  const logueado = localStorage.getItem("logueado");
  const rol = localStorage.getItem("rol");

  if (logueado === "true") {
    if (rol === "PERSONAL") {
      router.replace("/marcar");
    } else {
      router.replace("/dashboard");
    }
  }
}, [router]);

  useEffect(() => {
    async function cargarConfiguracion() {
      try {
        const res = await fetch("/api/configuracion");
        const data = await res.json();

        if (data.nombreColegio) {
          setNombreColegio(data.nombreColegio);
        }
      } catch (error) {
        console.error(error);
      }
    }

    cargarConfiguracion();
  }, []);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usuario,
        password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message);
      return;
    }

    localStorage.setItem("logueado", "true");
    localStorage.setItem("usuario", data.usuario);
    localStorage.setItem("rol", data.rol);

    if (data.rol === "ADMIN") {
  router.replace("/dashboard");
} else {
  router.replace("/marcar");
}
  }

  return (
    <main
  className="min-h-screen flex items-center justify-center bg-cover bg-center"
  style={{
    backgroundImage: "url('/img/colegio-santa-rita.jpg')",
  }}
>
      <form
        onSubmit={ingresar}
        
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-6">

  <Image
    src="/img/logo-santa-rita.png"
    alt="Logo"
    width={120}
    height={120}
    className="mx-auto mb-4"
  />

  <h1 className="text-3xl font-bold">
    {nombreColegio}
  </h1>

  <p className="text-gray-500">
    Sistema de Control de Asistencia Escolar
  </p>

</div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuario"
          className="border rounded-xl p-3 w-full mb-4"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="border rounded-xl p-3 w-full mb-6"
        />

        <button className="bg-blue-600 hover:bg-blue-700 text-white w-full py-3 rounded-xl font-bold">
          Ingresar
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

    <p className="mt-2 text-xs text-slate-400">
      © 2026
    </p>
  </div>

      </form>
    </main>
  );
}