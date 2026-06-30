"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InicioPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 2500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: "url('/img/colegio-santa-rita.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/65" />

      <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-10 text-center w-full max-w-md">
        <Image
          src="/img/logo-santa-rita.png"
          alt="Logo Santa Rita"
          width={130}
          height={130}
          className="mx-auto mb-5"
        />

        <h1 className="text-3xl font-extrabold text-slate-900">
          I.E. Santa Rita de Casia
        </h1>

        <p className="text-slate-600 mt-2">
          Sistema de Control de Asistencia Escolar
        </p>

        <p className="mt-4 text-sm font-bold text-blue-700">
          Versión 1.0 Enterprise
        </p>

        <div className="mt-6 border-t pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Desarrollado por
          </p>

          <h2 className="mt-2 text-lg font-extrabold text-slate-900">
            Marlon Barrientos Farfán
          </h2>

          <p className="text-sm text-blue-700 font-semibold">
            Ingeniero de Sistemas
          </p>

          <p className="text-xs text-slate-400 mt-1">
            © 2026
          </p>
        </div>

        <div className="mt-8">
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-600 h-3 rounded-full animate-pulse w-full" />
          </div>

          <p className="mt-4 text-slate-500 font-bold">
            Cargando sistema...
          </p>
        </div>
      </div>
    </main>
  );
}