"use client";

import { useMemo, useRef, useState } from "react";

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

type ResultadoLote = {
  ok: boolean;
  message?: string;
  total: number;
  procesados: number;
  siguienteOffset: number;
  finalizado: boolean;
  resumenLote?: {
    altos: number;
    medios: number;
    bajos: number;
  };
};

type ResultadoIndividual = {
  ok?: boolean;
  message?: string;
  estudiante?: {
    nombres: string;
    apellidos: string;
    dni: string;
    grado: string;
    seccion: string;
    turno: string | null;
  };
  calculoRiesgo?: {
    nivel: NivelRiesgo;
    porcentaje: number;
    explicacion: string;
  };
  indicadores?: {
    diasLectivosEsperados: number;
    diasConAsistencia: number;
    ausencias: number;
    puntuales: number;
    tardanzas: number;
    sinSalida: number;
    porcentajeAsistencia: number;
    porcentajePuntualidad: number;
    porcentajeTardanzas: number;
  };
  riesgo?: {
    resumen: string;
    recomendacion: string;
  };
};

export default function InteligenciaPage() {
  const [dni, setDni] = useState("");
  const [cargandoGeneral, setCargandoGeneral] =
    useState(false);
  const [cargandoIndividual, setCargandoIndividual] =
    useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [total, setTotal] = useState(0);
  const [procesados, setProcesados] = useState(0);
  const [grupoActual, setGrupoActual] = useState(0);
  const [totalGrupos, setTotalGrupos] = useState(0);

  const [altos, setAltos] = useState(0);
  const [medios, setMedios] = useState(0);
  const [bajos, setBajos] = useState(0);

  const [resultadoIndividual, setResultadoIndividual] =
    useState<ResultadoIndividual | null>(null);

  const cancelarRef = useRef(false);

  const porcentaje = useMemo(() => {
    if (total <= 0) return 0;
    return Math.min(
      100,
      Math.round((procesados / total) * 100)
    );
  }, [procesados, total]);

  async function analizarTodos() {
    setCargandoGeneral(true);
    setCancelando(false);
    setError("");
    setMensaje("");
    setProcesados(0);
    setGrupoActual(0);
    setAltos(0);
    setMedios(0);
    setBajos(0);
    setResultadoIndividual(null);

    cancelarRef.current = false;

    try {
      const respuestaConteo = await fetch(
        "/api/ia/riesgo-lotes",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const conteo = await respuestaConteo.json();

      if (!respuestaConteo.ok) {
        throw new Error(
          conteo.message ||
            "No se pudo obtener el total de estudiantes"
        );
      }

      const totalEstudiantes = Number(conteo.total || 0);
      const limite = Number(conteo.limitePorLote || 20);
      const grupos = Math.ceil(
        totalEstudiantes / limite
      );

      setTotal(totalEstudiantes);
      setTotalGrupos(grupos);

      let offset = 0;
      let acumuladoAltos = 0;
      let acumuladoMedios = 0;
      let acumuladoBajos = 0;
      let numeroGrupo = 0;

      while (offset < totalEstudiantes) {
        if (cancelarRef.current) {
          setMensaje(
            `Proceso detenido. Se conservaron ${offset} estudiantes ya analizados.`
          );
          break;
        }

        numeroGrupo++;
        setGrupoActual(numeroGrupo);

        const respuesta = await fetch(
          "/api/ia/riesgo-lotes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              offset,
              limite,
            }),
          }
        );

        const data =
          (await respuesta.json()) as ResultadoLote;

        if (!respuesta.ok || !data.ok) {
          throw new Error(
            data.message ||
              `Falló el grupo ${numeroGrupo}`
          );
        }

        acumuladoAltos +=
          data.resumenLote?.altos || 0;
        acumuladoMedios +=
          data.resumenLote?.medios || 0;
        acumuladoBajos +=
          data.resumenLote?.bajos || 0;

        setAltos(acumuladoAltos);
        setMedios(acumuladoMedios);
        setBajos(acumuladoBajos);

        offset = data.siguienteOffset;
        setProcesados(offset);

        if (data.finalizado) {
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 250)
        );
      }

      if (!cancelarRef.current) {
        setMensaje(
          `Análisis finalizado correctamente: ${totalEstudiantes} estudiantes procesados.`
        );

        window.dispatchEvent(
          new Event("riesgo-ia-actualizado")
        );
      }
    } catch (error) {
      console.error(
        "Error analizando estudiantes por lotes:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo completar el análisis general"
      );
    } finally {
      setCargandoGeneral(false);
      setCancelando(false);
    }
  }

  function cancelarAnalisis() {
    cancelarRef.current = true;
    setCancelando(true);
  }

async function analizarIndividual() {
  const dniLimpio = dni.trim();

  if (dniLimpio.length !== 8) {
    setError("El DNI debe tener exactamente 8 dígitos.");
    return;
  }

  setCargandoIndividual(true);
  setError("");
  setMensaje("");
  setResultadoIndividual(null);

  try {
    const respuesta = await fetch(
      "/api/ia/riesgo-estudiante",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dni: dniLimpio,
        }),
      }
    );

    const data =
      (await respuesta.json()) as ResultadoIndividual;

    // ←←← AQUÍ ESTÁ LA DIFERENCIA

    if (!respuesta.ok || !data.ok) {
      setError(
        data.message ||
          "No existe ningún estudiante con ese DNI."
      );
      return;
    }

    setResultadoIndividual(data);

    setMensaje(
      "Análisis generado correctamente."
    );

    window.dispatchEvent(
      new Event("riesgo-ia-actualizado")
    );
  } catch {
    setError(
      "No se pudo conectar con el servidor."
    );
  } finally {
    setCargandoIndividual(false);
  }
}

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-7">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-[30px] bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-200">
            Motor preventivo institucional
          </p>

          <h1 className="mt-3 text-3xl font-black md:text-4xl">
            🧠 Centro de Inteligencia Escolar
          </h1>

          <p className="mt-2 max-w-3xl text-sm font-semibold text-blue-100 md:text-base">
            Análisis objetivo de asistencia, tardanzas,
            ausencias y riesgo escolar por lotes seguros.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Metrica titulo="Motor" valor="Groq + cálculo local" />
          <Metrica titulo="Periodo" valor="30 días" />
          <Metrica titulo="Lote seguro" valor="20 estudiantes" />
          <Metrica
            titulo="Analizados"
            valor={`${procesados}/${total || 0}`}
          />
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Análisis general por lotes
              </h2>

              <p className="mt-2 text-sm font-semibold text-slate-500">
                Procesa todos los estudiantes en grupos de 20,
                guarda cada resultado y evita exceder los
                límites de tokens.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={analizarTodos}
                disabled={
                  cargandoGeneral ||
                  cargandoIndividual
                }
                className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cargandoGeneral
                  ? "Procesando..."
                  : "🧠 Analizar todos"}
              </button>

              {cargandoGeneral && (
                <button
                  onClick={cancelarAnalisis}
                  disabled={cancelando}
                  className="rounded-xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelando
                    ? "Deteniendo..."
                    : "⏹ Detener"}
                </button>
              )}
            </div>
          </div>

          {(cargandoGeneral || procesados > 0) && (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-blue-900">
                    {cargandoGeneral
                      ? "Análisis en progreso"
                      : "Último proceso"}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-blue-700">
                    Grupo {grupoActual} de{" "}
                    {totalGrupos || 0} · {procesados} de{" "}
                    {total} estudiantes
                  </p>
                </div>

                <span className="text-3xl font-black text-blue-700">
                  {porcentaje}%
                </span>
              </div>

              <div className="mt-4 h-4 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-500"
                  style={{
                    width: `${porcentaje}%`,
                  }}
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <ResumenNivel
                  titulo="Alto"
                  valor={altos}
                  clase="border-red-200 bg-red-50 text-red-700"
                />

                <ResumenNivel
                  titulo="Medio"
                  valor={medios}
                  clase="border-orange-200 bg-orange-50 text-orange-700"
                />

                <ResumenNivel
                  titulo="Bajo"
                  valor={bajos}
                  clase="border-emerald-200 bg-emerald-50 text-emerald-700"
                />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-lg">
          <h2 className="text-2xl font-black text-slate-900">
            Análisis individual con IA
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Busca por DNI para generar un resumen y una
            recomendación personalizada mediante Groq.
          </p>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              value={dni}
              onChange={(event) =>
                setDni(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 8)
                )
              }
              placeholder="Ingrese DNI"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 md:w-72"
            />

            <button
              onClick={analizarIndividual}
              disabled={
                cargandoIndividual ||
                cargandoGeneral ||
                !dni.trim()
              }
              className="rounded-xl bg-slate-900 px-6 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cargandoIndividual
                ? "Analizando..."
                : "🔎 Analizar por DNI"}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">
            ❌ {error}
          </div>
        )}

        {mensaje && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 font-bold text-emerald-700">
            ✅ {mensaje}
          </div>
        )}

        {resultadoIndividual?.estudiante &&
          resultadoIndividual.calculoRiesgo && (
            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-[28px] bg-white p-6 shadow-lg lg:col-span-2">
                <h2 className="text-2xl font-black text-slate-900">
                  📋 Resultado individual
                </h2>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xl font-black text-slate-900">
                    {
                      resultadoIndividual.estudiante
                        .nombres
                    }{" "}
                    {
                      resultadoIndividual.estudiante
                        .apellidos
                    }
                  </p>

                  <p className="mt-1 font-semibold text-slate-500">
                    DNI{" "}
                    {
                      resultadoIndividual.estudiante
                        .dni
                    }{" "}
                    ·{" "}
                    {
                      resultadoIndividual.estudiante
                        .grado
                    }{" "}
                    -{" "}
                    {
                      resultadoIndividual.estudiante
                        .seccion
                    }{" "}
                    ·{" "}
                    {resultadoIndividual.estudiante
                      .turno || "Sin turno"}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <ResumenNivel
                    titulo="Nivel"
                    valor={
                      resultadoIndividual
                        .calculoRiesgo.nivel
                    }
                    clase="border-violet-200 bg-violet-50 text-violet-700"
                  />

                  <ResumenNivel
                    titulo="Riesgo"
                    valor={`${resultadoIndividual.calculoRiesgo.porcentaje}%`}
                    clase="border-blue-200 bg-blue-50 text-blue-700"
                  />

                  <ResumenNivel
                    titulo="Asistencia"
                    valor={`${resultadoIndividual.indicadores?.porcentajeAsistencia || 0}%`}
                    clase="border-emerald-200 bg-emerald-50 text-emerald-700"
                  />
                </div>

                <div className="mt-5 space-y-4">
                  <TextoResultado
                    titulo="Resumen"
                    texto={
                      resultadoIndividual.riesgo
                        ?.resumen ||
                      resultadoIndividual
                        .calculoRiesgo.explicacion
                    }
                  />

                  <TextoResultado
                    titulo="Recomendación"
                    texto={
                      resultadoIndividual.riesgo
                        ?.recomendacion ||
                      "Mantener el seguimiento preventivo del estudiante."
                    }
                  />
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-lg">
                <h3 className="text-xl font-black text-slate-900">
                  Indicadores
                </h3>

                <div className="mt-5 space-y-3">
                  <Indicador
                    titulo="Días lectivos"
                    valor={
                      resultadoIndividual.indicadores
                        ?.diasLectivosEsperados || 0
                    }
                  />
                  <Indicador
                    titulo="Días con asistencia"
                    valor={
                      resultadoIndividual.indicadores
                        ?.diasConAsistencia || 0
                    }
                  />
                  <Indicador
                    titulo="Ausencias"
                    valor={
                      resultadoIndividual.indicadores
                        ?.ausencias || 0
                    }
                  />
                  <Indicador
                    titulo="Puntuales"
                    valor={
                      resultadoIndividual.indicadores
                        ?.puntuales || 0
                    }
                  />
                  <Indicador
                    titulo="Tardanzas"
                    valor={
                      resultadoIndividual.indicadores
                        ?.tardanzas || 0
                    }
                  />
                  <Indicador
                    titulo="Sin salida"
                    valor={
                      resultadoIndividual.indicadores
                        ?.sinSalida || 0
                    }
                  />
                </div>
              </div>
            </section>
          )}
      </div>
    </main>
  );
}

function Metrica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <p className="text-sm font-bold text-slate-500">
        {titulo}
      </p>
      <p className="mt-2 text-xl font-black text-slate-900">
        {valor}
      </p>
    </div>
  );
}

function ResumenNivel({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: number | string;
  clase: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${clase}`}>
      <p className="text-xs font-black uppercase tracking-wider opacity-70">
        {titulo}
      </p>
      <p className="mt-2 text-3xl font-black">
        {valor}
      </p>
    </div>
  );
}

function TextoResultado({
  titulo,
  texto,
}: {
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <p className="font-black text-slate-900">
        {titulo}
      </p>
      <p className="mt-2 leading-7 text-slate-700">
        {texto}
      </p>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="font-semibold text-slate-600">
        {titulo}
      </span>
      <span className="font-black text-slate-900">
        {valor}
      </span>
    </div>
  );
}