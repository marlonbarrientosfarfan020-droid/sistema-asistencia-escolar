"use client";

import { useState } from "react";

export default function UsuarioForm({
  onGuardado,
}: {
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({
    usuario: "",
    password: "",
    confirmar: "",
    rol: "PERSONAL",
  });

  const [mensaje, setMensaje] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    if (!form.usuario || !form.password || !form.confirmar) {
      setMensaje("⚠️ Complete todos los campos");
      return;
    }

    if (form.password !== form.confirmar) {
      setMensaje("⚠️ Las contraseñas no coinciden");
      return;
    }

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: form.usuario,
        password: form.password,
        rol: form.rol,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Usuario creado correctamente");
      setForm({
        usuario: "",
        password: "",
        confirmar: "",
        rol: "PERSONAL",
      });
      onGuardado();
    } else {
      setMensaje(`❌ ${data.message}`);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-xl font-bold mb-5">Crear usuario</h3>

      {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

      <form onSubmit={guardar} className="grid grid-cols-2 gap-5">
        <input
          value={form.usuario}
          onChange={(e) => setForm({ ...form, usuario: e.target.value })}
          placeholder="Usuario"
          className="border rounded-xl p-3"
        />

        <select
          value={form.rol}
          onChange={(e) => setForm({ ...form, rol: e.target.value })}
          className="border rounded-xl p-3"
        >
          <option value="ADMIN">Administrador</option>
          <option value="PERSONAL">Personal</option>
        </select>

        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Contraseña"
          className="border rounded-xl p-3"
        />

        <input
          type="password"
          value={form.confirmar}
          onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
          placeholder="Confirmar contraseña"
          className="border rounded-xl p-3"
        />

        <button className="col-span-2 bg-slate-900 text-white rounded-xl py-3 font-bold">
          Guardar usuario
        </button>
      </form>
    </div>
  );
}