"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";

type Turno = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  estado: boolean;
};

export default function TurnoTable({ refresh }: { refresh: number }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [mensaje, setMensaje] = useState("");

  async function cargarTurnos() {
    const res = await fetch("/api/turnos", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    const data = await res.json();

    if (Array.isArray(data)) {
      setTurnos(data);
    } else {
      setTurnos([]);
      setMensaje(`❌ ${data.message || "No autorizado"}`);
    }
  }

  useEffect(() => {
    cargarTurnos();
  }, [refresh]);

  function cambiarValor(id: number, campo: keyof Turno, valor: string | boolean) {
    setTurnos((lista) =>
      lista.map((turno) =>
        turno.id === id ? { ...turno, [campo]: valor } : turno
      )
    );
  }

  async function guardarTurno(turno: Turno) {
    const res = await fetch("/api/turnos", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": localStorage.getItem("rol") || "",
      },
      body: JSON.stringify(turno),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Turno actualizado correctamente");
      cargarTurnos();
    } else {
      setMensaje(`❌ ${data.message || "Error al actualizar turno"}`);
    }
  }

  return (
    <Card>
      <h3 className="text-xl font-bold mb-5">Lista de turnos</h3>

      {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-3">Turno</th>
            <th>Hora entrada</th>
            <th>Hora salida</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>

        <tbody>
          {turnos.map((turno) => (
            <tr key={turno.id} className="border-b">
              <td className="py-3">
                <input
                  value={turno.nombre}
                  onChange={(e) =>
                    cambiarValor(turno.id, "nombre", e.target.value)
                  }
                  className="border rounded-xl p-3 w-full"
                />
              </td>

              <td>
                <input
                  type="time"
                  value={turno.horaEntrada}
                  onChange={(e) =>
                    cambiarValor(turno.id, "horaEntrada", e.target.value)
                  }
                  className="border rounded-xl p-3"
                />
              </td>

              <td>
                <input
                  type="time"
                  value={turno.horaSalida}
                  onChange={(e) =>
                    cambiarValor(turno.id, "horaSalida", e.target.value)
                  }
                  className="border rounded-xl p-3"
                />
              </td>

              <td>
                <select
                  value={turno.estado ? "true" : "false"}
                  onChange={(e) =>
                    cambiarValor(turno.id, "estado", e.target.value === "true")
                  }
                  className="border rounded-xl p-3"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </td>

              <td>
                <button
                  onClick={() => guardarTurno(turno)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Guardar
                </button>
              </td>
            </tr>
          ))}

          {turnos.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-500">
                No hay turnos disponibles.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}