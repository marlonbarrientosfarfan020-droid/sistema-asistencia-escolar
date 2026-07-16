"use client";

import { useRouter } from "next/navigation";

export default function AccesoDenegadoPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
        <div className="text-7xl">🚫</div>

        <h1 className="mt-5 text-3xl font-black text-slate-900">
          Acceso denegado
        </h1>

        <p className="mt-3 text-slate-600">
          Su usuario no tiene permisos para ingresar a
          esta sección del sistema.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-100"
          >
            ← Regresar
          </button>

          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            Ir al panel
          </button>
        </div>
      </section>
    </main>
  );
}