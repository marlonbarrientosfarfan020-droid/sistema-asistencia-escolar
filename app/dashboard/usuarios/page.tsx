"use client";

import { useEffect, useState } from "react";

type Usuario = {
  id: number;
  usuario: string;
  rol: string;
  estado: boolean;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [editando, setEditando] = useState<Usuario | null>(null);

  const [form, setForm] = useState({
    usuario: "",
    password: "",
    confirmar: "",
    rol: "PERSONAL",
    estado: true,
  });

  useEffect(() => {
    const rolGuardado = localStorage.getItem("rol");

    if (rolGuardado !== "ADMIN") {
      window.location.href = "/dashboard";
      return;
    }

    cargarUsuarios();
  }, []);

  async function cargarUsuarios() {
    const res = await fetch("/api/usuarios", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    const data = await res.json();

    if (Array.isArray(data)) {
      setUsuarios(data);
    } else {
      setUsuarios([]);
      setMensaje(`❌ ${data.message || "No autorizado"}`);
    }
  }

  function limpiarFormulario() {
    setForm({
      usuario: "",
      password: "",
      confirmar: "",
      rol: "PERSONAL",
      estado: true,
    });
    setEditando(null);
  }

  function editarUsuario(usuario: Usuario) {
    setEditando(usuario);
    setForm({
      usuario: usuario.usuario,
      password: "",
      confirmar: "",
      rol: usuario.rol,
      estado: usuario.estado,
    });
  }

  async function guardarUsuario(e: React.FormEvent) {
    e.preventDefault();

    if (!form.usuario) return setMensaje("⚠️ Ingrese el usuario");
    if (!editando && (!form.password || !form.confirmar))
      return setMensaje("⚠️ Ingrese la contraseña");
    if (form.password !== form.confirmar)
      return setMensaje("⚠️ Las contraseñas no coinciden");

    const body: any = {
      usuario: form.usuario,
      rol: form.rol,
      estado: form.estado,
    };

    if (editando) body.id = editando.id;
    if (form.password) body.password = form.password;

    const res = await fetch("/api/usuarios", {
      method: editando ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": localStorage.getItem("rol") || "",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje(editando ? "✅ Usuario actualizado correctamente" : "✅ Usuario creado correctamente");
      limpiarFormulario();
      cargarUsuarios();
    } else {
      setMensaje(`❌ ${data.message}`);
    }
  }

  async function eliminarUsuario(id: number, usuario: string) {
    if (localStorage.getItem("usuario") === usuario) {
      setMensaje("⚠️ No puedes eliminar tu propio usuario.");
      return;
    }

    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

    const res = await fetch(`/api/usuarios?id=${id}`, {
      method: "DELETE",
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("🗑️ Usuario eliminado correctamente");
      cargarUsuarios();
    } else {
      setMensaje(`❌ ${data.message || "Error al eliminar usuario"}`);
    }
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-8">Gestión de Usuarios</h2>

      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-xl font-bold mb-5">
          {editando ? "Editar usuario" : "Crear usuario"}
        </h3>

        {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

        <form onSubmit={guardarUsuario} className="grid grid-cols-2 gap-5">
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
            <option value="DEMO">Demo</option>
            <option value="PERSONAL">Personal</option>
          </select>

          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editando ? "Nueva contraseña opcional" : "Contraseña"}
            className="border rounded-xl p-3"
          />

          <input
            type="password"
            value={form.confirmar}
            onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
            placeholder="Confirmar contraseña"
            className="border rounded-xl p-3"
          />

          <select
            value={form.estado ? "true" : "false"}
            onChange={(e) =>
              setForm({ ...form, estado: e.target.value === "true" })
            }
            className="border rounded-xl p-3 col-span-2"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>

          <button className="bg-slate-900 text-white rounded-xl py-3 font-bold">
            {editando ? "Actualizar usuario" : "Guardar usuario"}
          </button>

          {editando && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="bg-slate-200 text-slate-900 rounded-xl py-3 font-bold"
            >
              Cancelar edición
            </button>
          )}
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mt-8">
        <h3 className="text-xl font-bold mb-5">Lista de usuarios</h3>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-3">Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-b">
                <td className="py-3">{usuario.usuario}</td>
                <td>
                  {usuario.rol === "ADMIN"
                    ? "Administrador"
                    : usuario.rol === "DEMO"
                    ? "Demo"
                    : "Personal"}
                </td>
                <td>{usuario.estado ? "✅ Activo" : "❌ Inactivo"}</td>
                <td className="flex gap-2 py-2">
                  <button
                    onClick={() => editarUsuario(usuario)}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarUsuario(usuario.id, usuario.usuario)}
                    className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {usuarios.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}