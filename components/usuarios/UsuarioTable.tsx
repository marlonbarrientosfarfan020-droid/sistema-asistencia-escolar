"use client";

import { useEffect, useState } from "react";

type Usuario = {
  id: number;
  usuario: string;
  rol: string;
  estado: boolean;
};

export default function UsuarioTable({ refresh }: { refresh: number }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mensaje, setMensaje] = useState("");

  async function cargarUsuarios() {
    const res = await fetch("/api/usuarios");
    const data = await res.json();
    setUsuarios(data);
  }

  useEffect(() => {
    cargarUsuarios();
  }, [refresh]);

  async function eliminarUsuario(id: number) {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

    const res = await fetch(`/api/usuarios?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setMensaje("🗑️ Usuario eliminado correctamente");
      cargarUsuarios();
    } else {
      setMensaje("❌ Error al eliminar usuario");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-xl font-bold mb-5">Lista de usuarios</h3>

      {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

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
              <td>{usuario.rol === "ADMIN" ? "Administrador" : "Personal"}</td>
              <td>{usuario.estado ? "✅ Activo" : "❌ Inactivo"}</td>
              <td>
                <button
                  onClick={() => eliminarUsuario(usuario.id)}
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
  );
}