"use client";

import { useEffect, useState } from "react";

type Configuracion = {
  nombreColegio: string;
  direccion: string;
  telefono: string;
  correo: string;
  director: string;
  logoUrl: string;

  // Configuración anterior
  reporteTelegramActivo: boolean;
  horaReporteDiario: string;
  telegramDirectorChatId: string;
  enviarReporteExcel: boolean;
  enviarReportePdf: boolean;
  ultimoReporteTelegramAt?: string | null;
  ultimoReporteTelegramEstado: string;

  // Reporte automático para el director
  reporteDirectorActivo: boolean;
  frecuenciaReporteDirector: "DIARIO" | "SEMANAL";
  diaReporteDirector: number;
  horaReporteDirector: string;
  ultimoReporteDirectorAt?: string | null;

  // Reporte semanal para padres
  reportePadresActivo: boolean;
  diaReportePadres: number;
  horaReportePadres: string;
  incluirRiesgoIAReportePadres: boolean;
  ultimoReportePadresAt?: string | null;
};

const DIAS_SEMANA = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const FORM_INICIAL: Configuracion = {
  nombreColegio: "Santa Rita de Casia",
  direccion: "",
  telefono: "",
  correo: "",
  director: "",
  logoUrl: "",

  reporteTelegramActivo: false,
  horaReporteDiario: "21:00",
  telegramDirectorChatId: "",
  enviarReporteExcel: true,
  enviarReportePdf: true,
  ultimoReporteTelegramAt: null,
  ultimoReporteTelegramEstado: "",

  reporteDirectorActivo: false,
  frecuenciaReporteDirector: "DIARIO",
  diaReporteDirector: 5,
  horaReporteDirector: "21:00",
  ultimoReporteDirectorAt: null,

  reportePadresActivo: false,
  diaReportePadres: 5,
  horaReportePadres: "18:00",
  incluirRiesgoIAReportePadres: true,
  ultimoReportePadresAt: null,
};

export default function ConfiguracionPage() {
  const [form, setForm] = useState<Configuracion>(FORM_INICIAL);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [enviandoDirector, setEnviandoDirector] = useState(false);
  const [enviandoPadres, setEnviandoPadres] = useState(false);
const [archivoLogo, setArchivoLogo] = useState<File | null>(null);
const [subiendoLogo, setSubiendoLogo] = useState(false);
  

  async function cargarConfiguracion() {
    setCargando(true);

    try {
      const res = await fetch("/api/configuracion", {
  cache: "no-store",
  credentials: "include",
});

      const data = await res.json();

      if (!res.ok) {
        setMensaje(`❌ ${data.message || "No autorizado"}`);
        return;
      }

      setForm({
  nombreColegio: data.nombreColegio || "Santa Rita de Casia",
  direccion: data.direccion || "",
  telefono: data.telefono || "",
  correo: data.correo || "",
  director: data.director || "",
  logoUrl: data.logoUrl || "",


        reporteTelegramActivo:
          data.reporteTelegramActivo ?? false,

        horaReporteDiario:
          data.horaReporteDiario || "21:00",

        telegramDirectorChatId:
          data.telegramDirectorChatId || "",

        enviarReporteExcel:
          data.enviarReporteExcel ?? true,

        enviarReportePdf:
          data.enviarReportePdf ?? true,

        ultimoReporteTelegramAt:
          data.ultimoReporteTelegramAt || null,

        ultimoReporteTelegramEstado:
          data.ultimoReporteTelegramEstado || "",

        reporteDirectorActivo:
          data.reporteDirectorActivo ?? false,

        frecuenciaReporteDirector:
          data.frecuenciaReporteDirector === "SEMANAL"
            ? "SEMANAL"
            : "DIARIO",

        diaReporteDirector:
          Number(data.diaReporteDirector || 5),

        horaReporteDirector:
          data.horaReporteDirector || "21:00",

        ultimoReporteDirectorAt:
          data.ultimoReporteDirectorAt || null,

        reportePadresActivo:
          data.reportePadresActivo ?? false,

        diaReportePadres:
          Number(data.diaReportePadres || 5),

        horaReportePadres:
          data.horaReportePadres || "18:00",

        incluirRiesgoIAReportePadres:
          data.incluirRiesgoIAReportePadres ?? true,

        ultimoReportePadresAt:
          data.ultimoReportePadresAt || null,

          
      });

      setMensaje("");
    } catch (error) {
      console.error("Error cargando configuración:", error);
      setMensaje("❌ No se pudo cargar la configuración");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarConfiguracion();
  
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    setGuardando(true);
    setMensaje("⏳ Guardando configuración...");
    

    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: {
  "Content-Type": "application/json",
},
credentials: "include",
        body: JSON.stringify({
          ...form,

          // Compatibilidad con la configuración anterior
          reporteTelegramActivo: form.reporteDirectorActivo,
          horaReporteDiario: form.horaReporteDirector,
        }),
      });

      const data = await res.json();

    if (res.ok) {
  setMensaje("✅ Configuración guardada correctamente");

  window.dispatchEvent(
    new CustomEvent("configuracion-colegio-actualizada")
  );

  await cargarConfiguracion();
} else {
  setMensaje(
    `❌ ${data.message || "Error al guardar configuración"}`
  );
} {
        setMensaje(
          `❌ ${data.message || "Error al guardar configuración"}`
        );
      }
    } catch (error) {
      console.error("Error guardando configuración:", error);
      setMensaje("❌ No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }
 async function subirLogo() {
  if (!archivoLogo) {
    setMensaje("❌ Seleccione una imagen");
    return;
  }

  setSubiendoLogo(true);
  setMensaje("⏳ Subiendo logo...");

  try {
    const formData = new FormData();
    formData.append("logo", archivoLogo);

    const respuesta = await fetch(
      "/api/configuracion/logo",
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

    const textoRespuesta = await respuesta.text();

    let data: {
      ok?: boolean;
      message?: string;
      logoUrl?: string;
    } = {};

    if (textoRespuesta) {
      try {
        data = JSON.parse(textoRespuesta);
      } catch {
        data = {
          ok: false,
          message:
            "El servidor devolvió una respuesta inválida",
        };
      }
    }

    if (!respuesta.ok) {
      setMensaje(
        `❌ ${data.message || "No se pudo actualizar el logo"}`
      );
      return;
    }

    if (!data.logoUrl) {
      setMensaje(
        "❌ El servidor no devolvió la dirección del logo"
      );
      return;
    }

    setForm((actual) => ({
      ...actual,
      logoUrl: data.logoUrl || "",
    }));

    setArchivoLogo(null);
    setMensaje("✅ Logo actualizado correctamente");

    window.dispatchEvent(
      new CustomEvent("configuracion-colegio-actualizada")
    );
  } catch (error) {
    console.error("Error subiendo logo:", error);
    setMensaje("❌ Error al conectar con el servidor");
  } finally {
    setSubiendoLogo(false);
  }
}

  async function enviarDirectorAhora() {
    setEnviandoDirector(true);
    setMensaje("⏳ Generando reporte para el director...");

    try {
      const res = await fetch("/api/reportes/telegram-diario", {
  cache: "no-store",
  credentials: "include",
});

      const data = await res.json();

      if (res.ok) {
        setMensaje(
          data.omitido
            ? `📅 ${data.message}`
            : "✅ Reporte enviado correctamente al director"
        );

        await cargarConfiguracion();
      } else {
        setMensaje(
          `❌ ${data.message || "Error al enviar reporte al director"}`
        );
      }
    } catch (error) {
      console.error("Error enviando reporte al director:", error);
      setMensaje("❌ No se pudo enviar el reporte al director");
    } finally {
      setEnviandoDirector(false);
    }
  }

  async function enviarPadresAhora() {
    setEnviandoPadres(true);
    setMensaje("⏳ Generando reportes semanales para los padres...");

    try {
      const res = await fetch("/api/reportes/padres-semanal", {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
},
credentials: "include",
        body: JSON.stringify({
          forzarEnvio: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje(
          `✅ Proceso terminado: ${
            data.enviados ?? 0
          } enviados, ${data.omitidos ?? 0} omitidos y ${
            data.errores ?? 0
          } errores.`
        );

        await cargarConfiguracion();
      } else {
        setMensaje(
          `❌ ${
            data.message ||
            "Error al enviar los reportes semanales para padres"
          }`
        );
      }
    } catch (error) {
      console.error("Error enviando reportes a padres:", error);

      setMensaje(
        "❌ La ruta de reportes semanales para padres todavía no está disponible"
      );
    } finally {
      setEnviandoPadres(false);
    }
  }

  function formatearFecha(fecha?: string | null) {
    if (!fecha) return "Sin registro";

    return new Date(fecha).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    });
  }

  if (cargando) {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-6 font-bold">
        ⏳ Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="bg-gradient-to-r from-slate-900 to-blue-800 text-white rounded-3xl p-8 shadow-xl">
        <h1 className="text-4xl font-extrabold">
          ⚙️ Configuración y Reportes Automáticos
        </h1>

        <p className="text-blue-100 mt-2">
          Administra los datos institucionales y programa los reportes por
          Telegram para el director y los padres de familia.
        </p>
      </div>

      {mensaje && (
        <div className="bg-white border rounded-2xl p-5 shadow font-bold">
          {mensaje}
        </div>
      )}

      <form onSubmit={guardar} className="space-y-7">
        {/* DATOS DEL COLEGIO */}
        <section className="bg-white rounded-3xl shadow p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold">
              🏫 Datos de la institución
            </h2>

            <p className="text-slate-500 mt-1">
              Información que aparecerá en los reportes y notificaciones.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block font-bold mb-2">
                Nombre del colegio
              </label>

              <input
                value={form.nombreColegio}
                onChange={(e) =>
                  setForm({
                    ...form,
                    nombreColegio: e.target.value,
                  })
                }
                className="border rounded-xl p-3 w-full"
                placeholder="Nombre del colegio"
              />
            </div>
             <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col gap-5 md:flex-row md:items-center">
      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
        {form.logoUrl ? (
          <img
            src={form.logoUrl}
            alt="Logo institucional"
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <span className="text-4xl">🏫</span>
        )}
      </div>

      <div className="flex-1">
        <h3 className="text-xl font-black text-slate-900">
          Logo institucional
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          PNG, JPG o WEBP. Tamaño máximo: 2 MB.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              setArchivoLogo(e.target.files?.[0] || null)
            }
            className="w-full rounded-xl border border-slate-300 bg-white p-3"
          />

          <button
            type="button"
            onClick={subirLogo}
            disabled={!archivoLogo || subiendoLogo}
            className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subiendoLogo ? "Subiendo..." : "Cambiar logo"}
          </button>
        </div>
      </div>
    </div>
  </div>

  {/* NOMBRE DEL COLEGIO */}
  <div className="md:col-span-2">
    <label className="block font-bold mb-2">
      Nombre del colegio
    </label>

    <input
      value={form.nombreColegio}
      onChange={(e) =>
        setForm({
          ...form,
          nombreColegio: e.target.value,
        })
      }
      className="border rounded-xl p-3 w-full"
      placeholder="Nombre del colegio"
    />
  </div>

  <div>
    <label className="block font-bold mb-2">Director</label>

    <input
      value={form.director}
      onChange={(e) =>
        setForm({
          ...form,
          director: e.target.value,
        })
      }
      className="border rounded-xl p-3 w-full"
      placeholder="Nombre del director"
    />
  </div>

            <div>
              <label className="block font-bold mb-2">Director</label>

              <input
                value={form.director}
                onChange={(e) =>
                  setForm({
                    ...form,
                    director: e.target.value,
                  })
                }
                className="border rounded-xl p-3 w-full"
                placeholder="Nombre del director"
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Teléfono</label>

              <input
                value={form.telefono}
                onChange={(e) =>
                  setForm({
                    ...form,
                    telefono: e.target.value,
                  })
                }
                className="border rounded-xl p-3 w-full"
                placeholder="Teléfono institucional"
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Correo</label>

              <input
                type="email"
                value={form.correo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    correo: e.target.value,
                  })
                }
                className="border rounded-xl p-3 w-full"
                placeholder="Correo institucional"
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Dirección</label>

              <input
                value={form.direccion}
                onChange={(e) =>
                  setForm({
                    ...form,
                    direccion: e.target.value,
                  })
                }
                className="border rounded-xl p-3 w-full"
                placeholder="Dirección del colegio"
              />
            </div>
          </div>
        </section>

        {/* REPORTE DEL DIRECTOR */}
        <section className="bg-white rounded-3xl shadow overflow-hidden">
          <div className="bg-blue-700 text-white p-6">
            <h2 className="text-3xl font-extrabold">
              📊 Reporte automático para el director
            </h2>

            <p className="text-blue-100 mt-2">
              Resumen general de asistencia enviado al Telegram del director.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <label className="flex items-center gap-3 font-bold text-lg">
              <input
                type="checkbox"
                checked={form.reporteDirectorActivo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reporteDirectorActivo: e.target.checked,
                  })
                }
                className="w-5 h-5"
              />

              Activar reporte automático para el director
            </label>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block font-bold mb-2">
                  Frecuencia
                </label>

                <select
                  value={form.frecuenciaReporteDirector}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      frecuenciaReporteDirector:
                        e.target.value === "SEMANAL"
                          ? "SEMANAL"
                          : "DIARIO",
                    })
                  }
                  className="border rounded-xl p-3 w-full"
                >
                  <option value="DIARIO">Diario</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>

              {form.frecuenciaReporteDirector === "SEMANAL" && (
                <div>
                  <label className="block font-bold mb-2">
                    Día de envío
                  </label>

                  <select
                    value={form.diaReporteDirector}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        diaReporteDirector: Number(e.target.value),
                      })
                    }
                    className="border rounded-xl p-3 w-full"
                  >
                    {DIAS_SEMANA.map((dia) => (
                      <option key={dia.value} value={dia.value}>
                        {dia.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold mb-2">
                  Hora de envío
                </label>

                <input
                  type="time"
                  value={form.horaReporteDirector}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      horaReporteDirector: e.target.value,
                    })
                  }
                  className="border rounded-xl p-3 w-full"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">
                  Telegram Chat ID
                </label>

                <input
                  value={form.telegramDirectorChatId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telegramDirectorChatId:
                        e.target.value.replace(/[^\d-]/g, ""),
                    })
                  }
                  className="border rounded-xl p-3 w-full"
                  placeholder="Chat ID del director"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={form.enviarReporteExcel}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      enviarReporteExcel: e.target.checked,
                    })
                  }
                />
                Adjuntar Excel
              </label>

              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={form.enviarReportePdf}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      enviarReportePdf: e.target.checked,
                    })
                  }
                />
                Adjuntar PDF
              </label>
            </div>

            <div className="bg-slate-50 border rounded-2xl p-5">
              <p className="font-bold">
                Estado del último reporte:
                <span className="ml-2 text-blue-700">
                  {form.ultimoReporteTelegramEstado || "Aún no enviado"}
                </span>
              </p>

              <p className="text-slate-600 mt-2">
                Último envío:{" "}
                {formatearFecha(
                  form.ultimoReporteDirectorAt ||
                    form.ultimoReporteTelegramAt
                )}
              </p>

              <button
                type="button"
                onClick={enviarDirectorAhora}
                disabled={
                  enviandoDirector ||
                  !form.telegramDirectorChatId.trim()
                }
                className="mt-5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {enviandoDirector
                  ? "⏳ Enviando..."
                  : "📤 Enviar reporte al director ahora"}
              </button>
            </div>
          </div>
        </section>

        {/* REPORTE PARA PADRES */}
        <section className="bg-white rounded-3xl shadow overflow-hidden">
          <div className="bg-emerald-700 text-white p-6">
            <h2 className="text-3xl font-extrabold">
              👨‍👩‍👧 Reporte diario para padres
            </h2>

            <p className="text-emerald-100 mt-2">
              Cada tutor recibirá diariamente el resumen de asistencia de su hijo.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <label className="flex items-center gap-3 font-bold text-lg">
              <input
                type="checkbox"
                checked={form.reportePadresActivo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reportePadresActivo: e.target.checked,
                  })
                }
                className="w-5 h-5"
              />

              Activar reportes diarios para padres
            </label>

           <div className="grid md:grid-cols-2 gap-5">
             

              <div>
                <label className="block font-bold mb-2">
                  Hora de envío
                </label>

                <input
                  type="time"
                  value={form.horaReportePadres}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      horaReportePadres: e.target.value,
                    })
                  }
                  className="border rounded-xl p-3 w-full"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 font-bold border rounded-xl p-3 w-full">
                  <input
                    type="checkbox"
                    checked={form.incluirRiesgoIAReportePadres}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        incluirRiesgoIAReportePadres:
                          e.target.checked,
                      })
                    }
                  />

                  Incluir análisis y riesgo IA
                </label>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-green-50 text-green-700 rounded-2xl p-4 font-bold">
                ✅ Asistencias
              </div>

              <div className="bg-red-50 text-red-700 rounded-2xl p-4 font-bold">
                ❌ Ausencias reales
              </div>

              <div className="bg-orange-50 text-orange-700 rounded-2xl p-4 font-bold">
                🟠 Tardanzas
              </div>

              <div className="bg-purple-50 text-purple-700 rounded-2xl p-4 font-bold">
                🧠 Riesgo IA
              </div>
            </div>

            <div className="bg-slate-50 border rounded-2xl p-5">
              <p className="font-bold">
                Último envío diario:
                <span className="ml-2 text-emerald-700">
                  {formatearFecha(form.ultimoReportePadresAt)}
                </span>
              </p>

              <p className="text-slate-600 mt-2">
                Solo recibirán el reporte los estudiantes activos que tengan
                Telegram Chat ID registrado.
              </p>

              <button
                type="button"
                onClick={enviarPadresAhora}
                disabled={enviandoPadres}
                className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {enviandoPadres
                  ? "⏳ Enviando reportes..."
                  : "📤 Enviar reportes diarios ahora"}
              </button>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={guardando}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 text-lg font-bold disabled:opacity-50"
        >
          {guardando
            ? "⏳ Guardando..."
            : "💾 Guardar toda la configuración"}
        </button>
      </form>
    </div>
  );
}