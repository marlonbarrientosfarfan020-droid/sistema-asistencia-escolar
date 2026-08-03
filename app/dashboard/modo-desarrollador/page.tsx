"use client";

import {
  FormEvent,
  useState,
} from "react";

import ProteccionRol from "@/components/auth/ProteccionRol";

const FRASE_CONFIRMACION = "REINICIAR SISTEMA";

type ResultadoReinicio = {
  ok?: boolean;
  message?: string;

  eliminados?: {
    estudiantes?: number;
    asistencias?: number;
    alertas?: number;
    analisisIA?: number;
    riesgosIA?: number;
    reportesAutomaticos?: number;
    auditoriasPrueba?: number;
  };

  estadoActual?: {
    estudiantes?: number;
    asistencias?: number;
    alertas?: number;
    analisisIA?: number;
    riesgosIA?: number;
    reportesAutomaticos?: number;
  };

  conservado?: string[];
};

export default function ModoDesarrolladorPage() {
  const [confirmacion, setConfirmacion] =
    useState("");

  const [
    aceptaConsecuencias,
    setAceptaConsecuencias,
  ] = useState(false);

  const [procesando, setProcesando] =
    useState(false);

  const [error, setError] =
    useState("");

  const [resultado, setResultado] =
    useState<ResultadoReinicio | null>(null);

  const fraseCorrecta =
    confirmacion.trim().toUpperCase() ===
    FRASE_CONFIRMACION;

  const puedeReiniciar =
    fraseCorrecta &&
    aceptaConsecuencias &&
    !procesando;

  async function reiniciarSistema(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!puedeReiniciar) {
      return;
    }

    const confirmado = window.confirm(
      "ÚLTIMA CONFIRMACIÓN\n\n" +
        "Se eliminarán estudiantes, asistencias, " +
        "alertas, historiales, análisis y riesgos IA.\n\n" +
        "Esta acción no se puede deshacer."
    );

    if (!confirmado) {
      return;
    }

    setProcesando(true);
    setError("");
    setResultado(null);

    try {
      const respuesta = await fetch(
        "/api/desarrollador/reiniciar-sistema",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            confirmacion:
              confirmacion.trim(),
          }),
        }
      );

      const data =
        (await respuesta.json()) as ResultadoReinicio;

      if (!respuesta.ok) {
        setError(
          data.message ||
            "No se pudo reiniciar el sistema"
        );

        return;
      }

      setResultado(data);
      setConfirmacion("");
      setAceptaConsecuencias(false);
    } catch (error) {
      console.error(
        "Error reiniciando el sistema:",
        error
      );

      setError(
        "No se pudo conectar con el servidor"
      );
    } finally {
      setProcesando(false);
    }
  }

  return (
    <ProteccionRol
      rolesPermitidos={["ADMIN"]}
    >
      <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-950 via-slate-950 to-orange-950 p-7 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-300">
              Acceso exclusivo del administrador
            </p>

            <h1 className="mt-3 text-3xl font-black md:text-4xl">
              🧪 Modo desarrollador
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Reinicie todos los datos operativos
              de prueba antes de importar a los
              estudiantes reales de la institución.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6">
              <h2 className="text-xl font-black text-red-200">
                🗑️ Datos que se eliminarán
              </h2>

              <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-300">
                <Item texto="Todos los estudiantes" />
                <Item texto="Asistencias registradas" />
                <Item texto="Alertas de ingreso, tardanza y ausencia" />
                <Item texto="Análisis históricos de IA" />
                <Item texto="Riesgos IA por estudiante" />
                <Item texto="Historiales de reportes automáticos" />
                <Item texto="Auditorías generadas durante las pruebas" />
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-6">
              <h2 className="text-xl font-black text-emerald-200">
                🛡️ Datos que se conservarán
              </h2>

              <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-300">
                <Item texto="Usuarios y administrador" />
                <Item texto="Logo y configuración institucional" />
                <Item texto="Datos del colegio y director" />
                <Item texto="Turnos y horarios" />
                <Item texto="Calendario escolar" />
                <Item texto="Configuración de Telegram" />
              </div>
            </div>
          </section>

          <form
            onSubmit={reiniciarSistema}
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">
              Reiniciar sistema para producción
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
              Después del reinicio, el Dashboard,
              los reportes, las alertas y la IA
              comenzarán nuevamente desde cero.
            </p>

            <label className="mt-6 block">
              <span className="text-sm font-black text-slate-200">
                Escriba exactamente:
              </span>

              <code className="ml-2 rounded-lg bg-red-500/15 px-3 py-1 font-black text-red-300">
                {FRASE_CONFIRMACION}
              </code>

              <input
                value={confirmacion}
                onChange={(event) =>
                  setConfirmacion(
                    event.target.value
                  )
                }
                disabled={procesando}
                autoComplete="off"
                className="mt-3 h-14 w-full rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 font-black uppercase text-white outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10 disabled:opacity-60"
                placeholder={
                  FRASE_CONFIRMACION
                }
              />
            </label>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <input
                type="checkbox"
                checked={
                  aceptaConsecuencias
                }
                onChange={(event) =>
                  setAceptaConsecuencias(
                    event.target.checked
                  )
                }
                disabled={procesando}
                className="mt-1 h-5 w-5"
              />

              <span className="text-sm font-semibold leading-6 text-slate-300">
                Comprendo que esta acción
                eliminará todos los datos
                operativos de prueba y que no se
                puede deshacer.
              </span>
            </label>

            {!fraseCorrecta &&
              confirmacion.length > 0 && (
                <div className="mt-4 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-sm font-bold text-yellow-200">
                  ⚠️ La frase no coincide
                  exactamente.
                </div>
              )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-200">
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!puedeReiniciar}
              className="mt-6 w-full rounded-2xl bg-red-600 px-5 py-4 text-lg font-black text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {procesando
                ? "⏳ Reiniciando sistema..."
                : "🗑️ Reiniciar todos los datos de prueba"}
            </button>
          </form>

          {resultado && (
            <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
              <h2 className="text-2xl font-black text-emerald-200">
                ✅ Sistema limpio
              </h2>

              <p className="mt-2 font-semibold text-slate-300">
                {resultado.message}
              </p>

              <h3 className="mt-6 text-sm font-black uppercase tracking-wider text-slate-400">
                Estado actual
              </h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(
                  resultado.estadoActual || {}
                ).map(
                  ([nombre, cantidad]) => (
                    <div
                      key={nombre}
                      className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-4"
                    >
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                        {nombre}
                      </p>

                      <p className="mt-2 text-3xl font-black text-emerald-300">
                        {cantidad}
                      </p>
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/dashboard";
                }}
                className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white hover:bg-emerald-700"
              >
                Ir al Dashboard limpio
              </button>
            </section>
          )}
        </div>
      </main>
    </ProteccionRol>
  );
}

function Item({
  texto,
}: {
  texto: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/10 px-3 py-2">
      <span>•</span>
      <span>{texto}</span>
    </div>
  );
}