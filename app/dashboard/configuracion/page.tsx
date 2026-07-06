"use client";

import { useEffect, useState } from "react";

type Configuracion = {
  nombreColegio: string;
  direccion: string;
  telefono: string;
  correo: string;
  director: string;
  reporteTelegramActivo: boolean;
  horaReporteDiario: string;
  telegramDirectorChatId: string;
  enviarReporteExcel: boolean;
  enviarReportePdf: boolean;
  ultimoReporteTelegramAt?: string | null;
  ultimoReporteTelegramEstado: string;
};

export default function ConfiguracionPage() {
  const [form, setForm] = useState<Configuracion>({
    nombreColegio: "",
    direccion: "",
    telefono: "",
    correo: "",
    director: "",
    reporteTelegramActivo: false,
    horaReporteDiario: "21:00",
    telegramDirectorChatId: "",
    enviarReporteExcel: true,
    enviarReportePdf: true,
    ultimoReporteTelegramAt: null,
    ultimoReporteTelegramEstado: "",
  });

  const [mensaje, setMensaje] = useState("");

  async function cargarConfiguracion() {
    const res = await fetch("/api/configuracion", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMensaje(`❌ ${data.message || "No autorizado"}`);
      return;
    }

    setForm({
      nombreColegio: data.nombreColegio || "",
      direccion: data.direccion || "",
      telefono: data.telefono || "",
      correo: data.correo || "",
      director: data.director || "",
      reporteTelegramActivo: data.reporteTelegramActivo || false,
      horaReporteDiario: data.horaReporteDiario || "21:00",
      telegramDirectorChatId: data.telegramDirectorChatId || "",
      enviarReporteExcel: data.enviarReporteExcel ?? true,
      enviarReportePdf: data.enviarReportePdf ?? true,
      ultimoReporteTelegramAt: data.ultimoReporteTelegramAt || null,
      ultimoReporteTelegramEstado: data.ultimoReporteTelegramEstado || "",
    });
  }

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/configuracion", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": localStorage.getItem("rol") || "",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Configuración guardada correctamente");
      cargarConfiguracion();
    } else {
      setMensaje(`❌ ${data.message || "Error al guardar configuración"}`);
    }
  }

  async function enviarAhora() {
    setMensaje("⏳ Enviando reporte por Telegram...");

    const res = await fetch("/api/reportes/telegram-diario", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Reporte enviado correctamente por Telegram");
      cargarConfiguracion();
    } else {
      setMensaje(`❌ ${data.message || "Error al enviar reporte"}`);
    }
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-8">Configuración del Colegio</h2>

      <div className="bg-white rounded-2xl shadow p-6">
        {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

        <form onSubmit={guardar} className="grid grid-cols-2 gap-5">
          <input
            value={form.nombreColegio}
            onChange={(e) =>
              setForm({ ...form, nombreColegio: e.target.value })
            }
            placeholder="Nombre del colegio"
            className="border rounded-xl p-3 col-span-2"
          />

          <input
            value={form.director}
            onChange={(e) => setForm({ ...form, director: e.target.value })}
            placeholder="Director"
            className="border rounded-xl p-3"
          />

          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="Teléfono"
            className="border rounded-xl p-3"
          />

          <input
            value={form.correo}
            onChange={(e) => setForm({ ...form, correo: e.target.value })}
            placeholder="Correo"
            className="border rounded-xl p-3"
          />

          <input
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Dirección"
            className="border rounded-xl p-3"
          />

          <div className="col-span-2 border-t pt-6 mt-3">
            <h3 className="text-2xl font-bold mb-4">📊 Reportes Automáticos</h3>

            <label className="flex items-center gap-3 font-bold mb-4">
              <input
                type="checkbox"
                checked={form.reporteTelegramActivo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reporteTelegramActivo: e.target.checked,
                  })
                }
              />
              Activar envío automático por Telegram
            </label>

            <div className="grid grid-cols-2 gap-5">
              <input
                type="time"
                value={form.horaReporteDiario}
                onChange={(e) =>
                  setForm({ ...form, horaReporteDiario: e.target.value })
                }
                className="border rounded-xl p-3"
              />

              <input
                value={form.telegramDirectorChatId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    telegramDirectorChatId: e.target.value,
                  })
                }
                placeholder="Telegram Chat ID del director"
                className="border rounded-xl p-3"
              />
            </div>

            <div className="flex gap-6 mt-5">
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={form.enviarReporteExcel}
                  onChange={(e) =>
                    setForm({ ...form, enviarReporteExcel: e.target.checked })
                  }
                />
                Enviar Excel
              </label>

              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={form.enviarReportePdf}
                  onChange={(e) =>
                    setForm({ ...form, enviarReportePdf: e.target.checked })
                  }
                />
                Enviar PDF
              </label>
            </div>

            <div className="mt-6 bg-slate-100 rounded-2xl p-5">
              <h4 className="text-xl font-bold mb-3">
                📅 Último reporte enviado
              </h4>

              <p className="font-bold">
                Estado:{" "}
                {form.ultimoReporteTelegramEstado ? (
                  <span className="text-green-700">
                    {form.ultimoReporteTelegramEstado}
                  </span>
                ) : (
                  <span className="text-slate-500">Aún no enviado</span>
                )}
              </p>

              <p className="mt-2 text-slate-600">
                Fecha:{" "}
                {form.ultimoReporteTelegramAt
                  ? new Date(form.ultimoReporteTelegramAt).toLocaleString(
                      "es-PE"
                    )
                  : "Sin registro"}
              </p>

              <button
                type="button"
                onClick={enviarAhora}
                className="mt-5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold"
              >
                📤 Enviar ahora
              </button>
            </div>
          </div>

          <button className="col-span-2 bg-slate-900 text-white rounded-xl py-3 font-bold">
            Guardar configuración
          </button>
        </form>
      </div>
    </>
  );
}