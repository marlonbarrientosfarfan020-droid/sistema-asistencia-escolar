"use client";

import { useEffect, useState } from "react";

type Configuracion = {
  nombreColegio: string;
  direccion: string;
  telefono: string;
  correo: string;
  director: string;
  horaEntrada: string;
  tiempoMinSalida: number;
};

export default function ConfiguracionPage() {
  const [form, setForm] = useState<Configuracion>({
    nombreColegio: "",
    direccion: "",
    telefono: "",
    correo: "",
    director: "",
    horaEntrada: "07:30",
    tiempoMinSalida: 30,
  });

  const [mensaje, setMensaje] = useState("");

  async function cargarConfiguracion() {
    const res = await fetch("/api/configuracion");
    const data = await res.json();

    setForm({
      nombreColegio: data.nombreColegio || "",
      direccion: data.direccion || "",
      telefono: data.telefono || "",
      correo: data.correo || "",
      director: data.director || "",
      horaEntrada: data.horaEntrada || "07:30",
      tiempoMinSalida: data.tiempoMinSalida || 30,
    });
  }

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setMensaje("✅ Configuración guardada correctamente");
    } else {
      setMensaje("❌ Error al guardar configuración");
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

          <input
            type="time"
            value={form.horaEntrada}
            onChange={(e) => setForm({ ...form, horaEntrada: e.target.value })}
            className="border rounded-xl p-3"
          />

          <input
            type="number"
            value={form.tiempoMinSalida}
            onChange={(e) =>
              setForm({ ...form, tiempoMinSalida: Number(e.target.value) })
            }
            placeholder="Tiempo mínimo para salida"
            className="border rounded-xl p-3"
          />

          <button className="col-span-2 bg-slate-900 text-white rounded-xl py-3 font-bold">
            Guardar configuración
          </button>
        </form>
      </div>
    </>
  );
}