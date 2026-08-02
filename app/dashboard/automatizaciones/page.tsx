"use client";

import { useEffect, useState } from "react";

type ConfiguracionAutomatizaciones = {
  automatizacionesActivas: boolean;
  alertaIngresoPendienteActiva: boolean;
  minutosAlertaInicial: number;
  alertaTardanzaActiva: boolean;
  alertaAusenciaActiva: boolean;
  modoPruebaAlertas: boolean;
  telegramPruebaChatId: string;
  frecuenciaRevisionMinutos: number;
  ultimaEjecucionAutomatizaciones: string | null;
  ultimaEjecucionEstado: string;
};

type ResultadoEjecucion = {
  ok?: boolean;
  ejecutado?: boolean;
  message?: string;

  resumen?: {
    totalEstudiantes: number;
    alertasInicialesEnviadas: number;
    alertasTardanzaEnviadas: number;
    ausenciasConfirmadasEnviadas: number;
    erroresEnvio: number;
  };
};

const configuracionInicial: ConfiguracionAutomatizaciones = {
  automatizacionesActivas: false,
  alertaIngresoPendienteActiva: true,
  minutosAlertaInicial: 5,
  alertaTardanzaActiva: true,
  alertaAusenciaActiva: true,
  modoPruebaAlertas: true,
  telegramPruebaChatId: "",
  frecuenciaRevisionMinutos: 5,
  ultimaEjecucionAutomatizaciones: null,
  ultimaEjecucionEstado: "",
};

export default function AutomatizacionesPage() {
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionAutomatizaciones>(
      configuracionInicial
    );

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] =
    useState<ResultadoEjecucion | null>(null);

  async function cargarConfiguracion() {
    setCargando(true);
    setMensaje("");

    try {
      const respuesta = await fetch(
        "/api/automatizaciones",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok || !data.ok) {
        setMensaje(
          `❌ ${
            data.message ||
            "No se pudo cargar la configuración"
          }`
        );

        return;
      }

      setConfiguracion({
        automatizacionesActivas:
          Boolean(data.automatizacionesActivas),

        alertaIngresoPendienteActiva:
          Boolean(
            data.alertaIngresoPendienteActiva
          ),

        minutosAlertaInicial:
          Number(data.minutosAlertaInicial || 5),

        alertaTardanzaActiva:
          Boolean(data.alertaTardanzaActiva),

        alertaAusenciaActiva:
          Boolean(data.alertaAusenciaActiva),

        modoPruebaAlertas:
          Boolean(data.modoPruebaAlertas),

        telegramPruebaChatId:
          String(data.telegramPruebaChatId || ""),

        frecuenciaRevisionMinutos:
          Number(
            data.frecuenciaRevisionMinutos || 5
          ),

        ultimaEjecucionAutomatizaciones:
          data.ultimaEjecucionAutomatizaciones ||
          null,

        ultimaEjecucionEstado:
          String(
            data.ultimaEjecucionEstado || ""
          ),
      });
    } catch (error) {
      console.error(
        "Error cargando automatizaciones:",
        error
      );

      setMensaje(
        "❌ No se pudo conectar con el servidor"
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarConfiguracion();
  }, []);

  function actualizarCampo<
    K extends keyof ConfiguracionAutomatizaciones,
  >(
    campo: K,
    valor: ConfiguracionAutomatizaciones[K]
  ) {
    setConfiguracion((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  async function guardarConfiguracion() {
    setGuardando(true);
    setMensaje("");
    setResultado(null);

    try {
      const respuesta = await fetch(
        "/api/automatizaciones",
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            automatizacionesActivas:
              configuracion.automatizacionesActivas,

            alertaIngresoPendienteActiva:
              configuracion
                .alertaIngresoPendienteActiva,

            minutosAlertaInicial:
              configuracion.minutosAlertaInicial,

            alertaTardanzaActiva:
              configuracion.alertaTardanzaActiva,

            alertaAusenciaActiva:
              configuracion.alertaAusenciaActiva,

            modoPruebaAlertas:
              configuracion.modoPruebaAlertas,

            telegramPruebaChatId:
              configuracion.telegramPruebaChatId,

            frecuenciaRevisionMinutos:
              configuracion
                .frecuenciaRevisionMinutos,
          }),
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok || !data.ok) {
        setMensaje(
          `❌ ${
            data.message ||
            "No se pudo guardar la configuración"
          }`
        );

        return;
      }

      setMensaje(
        "✅ Configuración guardada correctamente"
      );

      await cargarConfiguracion();
    } catch (error) {
      console.error(
        "Error guardando automatizaciones:",
        error
      );

      setMensaje(
        "❌ No se pudo guardar la configuración"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarAhora() {
    if (!configuracion.automatizacionesActivas) {
      setMensaje(
        "⚠️ Primero active las automatizaciones y guarde la configuración."
      );

      return;
    }

    const confirmar = window.confirm(
      configuracion.modoPruebaAlertas
        ? "Se ejecutará una prueba. Como máximo se enviarán 5 alertas a su Telegram de prueba. ¿Continuar?"
        : "Está en modo real. Las alertas podrán enviarse a los padres registrados. ¿Continuar?"
    );

    if (!confirmar) {
      return;
    }

    setEjecutando(true);
    setMensaje(
      "⏳ Ejecutando revisión de alertas..."
    );
    setResultado(null);

    try {
      const respuesta = await fetch(
        "/api/alertas/ausentes",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data =
        (await respuesta.json()) as ResultadoEjecucion;

      setResultado(data);

      if (!respuesta.ok || !data.ok) {
        setMensaje(
          `❌ ${
            data.message ||
            "La ejecución no pudo completarse"
          }`
        );

        return;
      }

      setMensaje(
        `✅ ${
          data.message ||
          "Automatización ejecutada correctamente"
        }`
      );

      await cargarConfiguracion();
    } catch (error) {
      console.error(
        "Error ejecutando automatizaciones:",
        error
      );

      setMensaje(
        "❌ No se pudo ejecutar la automatización"
      );
    } finally {
      setEjecutando(false);
    }
  }

  function fechaHora(
    valor: string | null | undefined
  ) {
    if (!valor) {
      return "Aún no ejecutado";
    }

    return new Date(valor).toLocaleString(
      "es-PE",
      {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Lima",
      }
    );
  }

  const totalAlertasUltimaEjecucion =
    (resultado?.resumen
      ?.alertasInicialesEnviadas || 0) +
    (resultado?.resumen
      ?.alertasTardanzaEnviadas || 0) +
    (resultado?.resumen
      ?.ausenciasConfirmadasEnviadas || 0);

  return (
    <main className="min-h-screen space-y-6 bg-slate-100 p-4 md:p-7">
      {/* CABECERA */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-slate-950 via-blue-950 to-violet-950 p-7 text-white shadow-2xl md:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-300">
              Centro de control
            </p>

            <h1 className="mt-3 text-3xl font-black md:text-4xl">
              ⚙️ Automatizaciones
            </h1>

            <p className="mt-2 max-w-3xl text-slate-300">
              Configure las alertas automáticas de
              ingreso pendiente, tardanza y ausencia.
            </p>
          </div>

          <EstadoGeneral
            activo={
              configuracion.automatizacionesActivas
            }
            modoPrueba={
              configuracion.modoPruebaAlertas
            }
          />
        </div>
      </section>

      {mensaje && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 font-bold shadow-sm">
          {mensaje}
        </section>
      )}

      {cargando ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-12 text-center font-bold text-slate-500 shadow-sm">
          Cargando configuración...
        </section>
      ) : (
        <>
          {/* ESTADO GENERAL */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              titulo="Motor automático"
              valor={
                configuracion.automatizacionesActivas
                  ? "ACTIVO"
                  : "APAGADO"
              }
              icono={
                configuracion.automatizacionesActivas
                  ? "🟢"
                  : "🔴"
              }
              clase={
                configuracion.automatizacionesActivas
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }
            />

            <Indicador
              titulo="Modo de envío"
              valor={
                configuracion.modoPruebaAlertas
                  ? "PRUEBA"
                  : "PADRES"
              }
              icono={
                configuracion.modoPruebaAlertas
                  ? "🧪"
                  : "👨‍👩‍👧"
              }
              clase={
                configuracion.modoPruebaAlertas
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }
            />

            <Indicador
              titulo="Frecuencia configurada"
              valor={`${configuracion.frecuenciaRevisionMinutos} min`}
              icono="⏱️"
              clase="border-blue-200 bg-blue-50 text-blue-700"
            />

            <Indicador
              titulo="Última ejecución"
              valor={fechaHora(
                configuracion.ultimaEjecucionAutomatizaciones
              )}
              icono="🕒"
              clase="border-slate-200 bg-white text-slate-700"
            />
          </section>

          {/* ACTIVACIÓN GENERAL */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Interruptor principal
                </h2>

                <p className="mt-1 text-slate-500">
                  Cuando está apagado, el cron puede
                  ejecutarse, pero no se enviará ninguna
                  alerta.
                </p>
              </div>

              <Interruptor
                activo={
                  configuracion.automatizacionesActivas
                }
                onChange={(valor) =>
                  actualizarCampo(
                    "automatizacionesActivas",
                    valor
                  )
                }
                etiquetaActiva="Automatizaciones activas"
                etiquetaInactiva="Automatizaciones apagadas"
              />
            </div>
          </section>

          {/* TIPOS DE ALERTA */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                🔔 Tipos de alerta
              </h2>

              <p className="mt-1 text-slate-500">
                Active solamente las alertas que desea
                utilizar.
              </p>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <TarjetaAlerta
                icono="🟡"
                titulo="Ingreso pendiente"
                descripcion="Avisa que el estudiante todavía no registra ingreso, pero continúa dentro del margen permitido."
                clase="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50"
              >
                <Interruptor
                  activo={
                    configuracion
                      .alertaIngresoPendienteActiva
                  }
                  onChange={(valor) =>
                    actualizarCampo(
                      "alertaIngresoPendienteActiva",
                      valor
                    )
                  }
                  etiquetaActiva="Activada"
                  etiquetaInactiva="Desactivada"
                  compacto
                />

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-black text-slate-600">
                    Enviar después de
                  </label>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={
                        configuracion.minutosAlertaInicial
                      }
                      onChange={(evento) =>
                        actualizarCampo(
                          "minutosAlertaInicial",
                          Math.max(
                            1,
                            Math.min(
                              120,
                              Number(
                                evento.target.value
                              ) || 1
                            )
                          )
                        )
                      }
                      className="w-28 rounded-xl border border-slate-300 p-3 text-center font-black outline-none focus:ring-2 focus:ring-amber-500"
                    />

                    <span className="font-bold text-slate-600">
                      minutos
                    </span>
                  </div>
                </div>
              </TarjetaAlerta>

              <TarjetaAlerta
                icono="🟠"
                titulo="Alerta de tardanza"
                descripcion="Se envía cuando el estudiante supera el margen configurado dentro de su turno."
                clase="border-orange-200 bg-gradient-to-br from-orange-50 to-red-50"
              >
                <Interruptor
                  activo={
                    configuracion.alertaTardanzaActiva
                  }
                  onChange={(valor) =>
                    actualizarCampo(
                      "alertaTardanzaActiva",
                      valor
                    )
                  }
                  etiquetaActiva="Activada"
                  etiquetaInactiva="Desactivada"
                  compacto
                />

                <p className="mt-5 rounded-xl bg-white/80 p-3 text-sm font-semibold text-slate-600">
                  El margen se obtiene de la configuración
                  individual de cada turno.
                </p>
              </TarjetaAlerta>

              <TarjetaAlerta
                icono="🔴"
                titulo="Ausencia confirmada"
                descripcion="Se envía cuando termina el turno y el estudiante nunca registró una entrada."
                clase="border-red-200 bg-gradient-to-br from-red-50 to-rose-50"
              >
                <Interruptor
                  activo={
                    configuracion.alertaAusenciaActiva
                  }
                  onChange={(valor) =>
                    actualizarCampo(
                      "alertaAusenciaActiva",
                      valor
                    )
                  }
                  etiquetaActiva="Activada"
                  etiquetaInactiva="Desactivada"
                  compacto
                />

                <p className="mt-5 rounded-xl bg-white/80 p-3 text-sm font-semibold text-slate-600">
                  La ausencia se confirma al alcanzar la
                  hora de salida del turno.
                </p>
              </TarjetaAlerta>
            </div>
          </section>

          {/* MODO PRUEBA */}
          <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-6 shadow-sm md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-2xl font-black text-violet-950">
                  🧪 Modo prueba
                </h2>

                <p className="mt-2 text-violet-800">
                  En modo prueba, las alertas no se envían a
                  los padres. Todas se redirigen al Telegram
                  del administrador y se limita el envío a
                  cinco mensajes por ejecución.
                </p>
              </div>

              <Interruptor
                activo={
                  configuracion.modoPruebaAlertas
                }
                onChange={(valor) =>
                  actualizarCampo(
                    "modoPruebaAlertas",
                    valor
                  )
                }
                etiquetaActiva="Modo prueba activo"
                etiquetaInactiva="Modo real"
              />
            </div>

            {configuracion.modoPruebaAlertas && (
              <div className="mt-6 max-w-xl">
                <label className="mb-2 block text-sm font-black text-violet-900">
                  Telegram Chat ID de prueba
                </label>

                <input
                  value={
                    configuracion.telegramPruebaChatId
                  }
                  onChange={(evento) =>
                    actualizarCampo(
                      "telegramPruebaChatId",
                      evento.target.value
                        .replace(/\D/g, "")
                        .slice(0, 20)
                    )
                  }
                  placeholder="Ejemplo: 7530504168"
                  className="w-full rounded-xl border border-violet-300 bg-white p-3 font-bold outline-none focus:ring-2 focus:ring-violet-500"
                />

                <p className="mt-2 text-sm font-semibold text-violet-700">
                  Actualmente puedes colocar:
                  <span className="ml-1 font-black">
                    7530504168
                  </span>
                </p>
              </div>
            )}

            {!configuracion.modoPruebaAlertas && (
              <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 font-bold text-red-700">
                ⚠️ Modo real activado: cada mensaje se
                enviará al Telegram Chat ID registrado en el
                estudiante correspondiente.
              </div>
            )}
          </section>

          {/* FRECUENCIA */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <h2 className="text-2xl font-black text-slate-900">
              ⏱️ Frecuencia de revisión
            </h2>

            <p className="mt-1 text-slate-500">
              Debe coincidir con la frecuencia configurada
              en cron-job.org.
            </p>

            <div className="mt-5 max-w-md">
              <select
                value={
                  configuracion.frecuenciaRevisionMinutos
                }
                onChange={(evento) =>
                  actualizarCampo(
                    "frecuenciaRevisionMinutos",
                    Number(evento.target.value)
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>
                  Cada minuto
                </option>

                <option value={5}>
                  Cada 5 minutos
                </option>

                <option value={10}>
                  Cada 10 minutos
                </option>

                <option value={15}>
                  Cada 15 minutos
                </option>

                <option value={30}>
                  Cada 30 minutos
                </option>
              </select>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
              Para una revisión cada 5 minutos, la expresión
              de cron-job.org debe ser:

              <code className="ml-2 rounded bg-blue-950 px-3 py-1 font-black text-white">
                */5 * * * 1-6
              </code>
            </div>
          </section>

          {/* ÚLTIMA EJECUCIÓN */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <h2 className="text-2xl font-black text-slate-900">
              📋 Estado de la última ejecución
            </h2>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Fecha y hora
                </p>

                <p className="mt-2 text-lg font-black text-slate-900">
                  {fechaHora(
                    configuracion
                      .ultimaEjecucionAutomatizaciones
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Resultado
                </p>

                <p className="mt-2 font-bold text-slate-800">
                  {configuracion.ultimaEjecucionEstado ||
                    "Sin información"}
                </p>
              </div>
            </div>
          </section>

          {/* RESULTADO MANUAL */}
          {resultado?.resumen && (
            <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm md:p-7">
              <h2 className="text-2xl font-black text-blue-950">
                📊 Resultado de la prueba
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MiniIndicador
                  titulo="Estudiantes"
                  valor={
                    resultado.resumen
                      .totalEstudiantes
                  }
                  icono="👨‍🎓"
                />

                <MiniIndicador
                  titulo="Avisos iniciales"
                  valor={
                    resultado.resumen
                      .alertasInicialesEnviadas
                  }
                  icono="🟡"
                />

                <MiniIndicador
                  titulo="Tardanzas"
                  valor={
                    resultado.resumen
                      .alertasTardanzaEnviadas
                  }
                  icono="🟠"
                />

                <MiniIndicador
                  titulo="Ausencias"
                  valor={
                    resultado.resumen
                      .ausenciasConfirmadasEnviadas
                  }
                  icono="🔴"
                />

                <MiniIndicador
                  titulo="Errores"
                  valor={
                    resultado.resumen.erroresEnvio
                  }
                  icono="⚠️"
                />
              </div>

              <p className="mt-5 font-bold text-blue-900">
                Total de alertas enviadas en esta ejecución:{" "}
                {totalAlertasUltimaEjecucion}
              </p>
            </section>
          )}

          {/* BOTONES */}
          <section className="sticky bottom-4 z-20 rounded-3xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() =>
                  void cargarConfiguracion()
                }
                disabled={
                  cargando ||
                  guardando ||
                  ejecutando
                }
                className="rounded-xl bg-slate-700 px-6 py-3 font-black text-white transition hover:bg-slate-600 disabled:opacity-50"
              >
                🔄 Recargar
              </button>

              <button
                type="button"
                onClick={() =>
                  void guardarConfiguracion()
                }
                disabled={
                  guardando || ejecutando
                }
                className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando
                  ? "Guardando..."
                  : "💾 Guardar configuración"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void ejecutarAhora()
                }
                disabled={
                  ejecutando ||
                  guardando ||
                  !configuracion
                    .automatizacionesActivas
                }
                className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-black text-white transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ejecutando
                  ? "Ejecutando..."
                  : "▶ Ejecutar ahora"}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function EstadoGeneral({
  activo,
  modoPrueba,
}: {
  activo: boolean;
  modoPrueba: boolean;
}) {
  return (
    <div className="min-w-[260px] rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-wider text-slate-300">
        Estado actual
      </p>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl">
          {activo ? "🟢" : "🔴"}
        </span>

        <div>
          <p className="text-xl font-black">
            {activo ? "Activo" : "Apagado"}
          </p>

          <p className="text-sm text-slate-300">
            {modoPrueba
              ? "Modo de prueba"
              : "Envío real a padres"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  icono,
  clase,
}: {
  titulo: string;
  valor: string | number;
  icono: string;
  clase: string;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${clase}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black opacity-70">
            {titulo}
          </p>

          <p className="mt-3 break-words text-xl font-black">
            {valor}
          </p>
        </div>

        <span className="text-3xl">{icono}</span>
      </div>
    </div>
  );
}

function MiniIndicador({
  titulo,
  valor,
  icono,
}: {
  titulo: string;
  valor: number;
  icono: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-black text-slate-500">
        {icono} {titulo}
      </p>

      <p className="mt-2 text-3xl font-black text-slate-900">
        {valor}
      </p>
    </div>
  );
}

function TarjetaAlerta({
  icono,
  titulo,
  descripcion,
  clase,
  children,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  clase: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${clase}`}
    >
      <span className="text-4xl">{icono}</span>

      <h3 className="mt-4 text-xl font-black text-slate-900">
        {titulo}
      </h3>

      <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">
        {descripcion}
      </p>

      <div className="mt-5">{children}</div>
    </div>
  );
}

function Interruptor({
  activo,
  onChange,
  etiquetaActiva,
  etiquetaInactiva,
  compacto = false,
}: {
  activo: boolean;
  onChange: (valor: boolean) => void;
  etiquetaActiva: string;
  etiquetaInactiva: string;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!activo)}
      className={`flex items-center gap-3 rounded-2xl border font-black transition ${
        compacto
          ? "px-3 py-2 text-sm"
          : "px-5 py-3"
      } ${
        activo
          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
          : "border-slate-300 bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`relative inline-flex h-7 w-12 rounded-full transition ${
          activo ? "bg-emerald-600" : "bg-slate-400"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            activo ? "left-6" : "left-1"
          }`}
        />
      </span>

      {activo
        ? etiquetaActiva
        : etiquetaInactiva}
    </button>
  );
}