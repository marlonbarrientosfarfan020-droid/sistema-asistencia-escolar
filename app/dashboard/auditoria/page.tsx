"use client";

import { useEffect, useState } from "react";

type Auditoria = {
  id: number;
  usuario: string;
  rol: string;
  accion: string;
  modulo: string;
  detalle: string;
  createdAt: string;
};

export default function AuditoriaPage() {
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [mensaje, setMensaje] = useState("");

  async function cargarAuditoria() {
    const res = await fetch("/api/auditoria", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
    });

    const data = await res.json();

    if (Array.isArray(data)) {
      setAuditoria(data);
    } else {
      setAuditoria([]);
      setMensaje(`❌ ${data.message || "No autorizado"}`);
    }
  }

  useEffect(() => {
    cargarAuditoria();
  }, []);

  function fecha(fecha: string) {
    return new Date(fecha).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-8">Historial de Auditoría</h2>

      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-xl font-bold mb-5">Registro de acciones</h3>

        {mensaje && <p className="mb-4 font-bold text-red-600">{mensaje}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b">
                <th className="py-3">Fecha</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {auditoria.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3">{fecha(item.createdAt)}</td>
                  <td className="font-bold">{item.usuario}</td>
                  <td>{item.rol}</td>
                  <td>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                      {item.accion}
                    </span>
                  </td>
                  <td>{item.modulo}</td>
                  <td>{item.detalle}</td>
                </tr>
              ))}

              {auditoria.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No hay acciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}