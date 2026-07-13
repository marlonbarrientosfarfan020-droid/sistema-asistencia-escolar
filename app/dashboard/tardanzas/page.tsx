"use client";

import { useEffect, useState } from "react";

type Tardanza = {
  id: number;
  fecha: string;
  horaEntrada: string | null;
  metodo: string;
  minutosTardanza: number;
  estudiante: {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    turno: string;
  };
};

function fechaHoyPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function TardanzasPage() {
  const [fecha, setFecha] = useState(fechaHoyPeru());
  const [dni, setDni] = useState("");
  const [tardanzas, setTardanzas] = useState<Tardanza[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargarTardanzas() {
    setCargando(true);
    setMensaje("");

    try {
      const params = new URLSearchParams({
        fecha,
      });

      if (dni.trim()) {
        params.set("dni", dni.trim());
      }

      const respuesta = await fetch(
        `/api/tardanzas?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok) {
        setMensaje(
          `❌ ${data.message || "No se pudieron cargar las tardanzas"}`
        );
        return;
      }

      setTardanzas(
        Array.isArray(data.tardanzas)
          ? data.tardanzas
          : []
      );
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error al conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTardanzas();
  }, [fecha]);

  function hora(fechaHora: string | null) {
    if (!fechaHora) return "-";

    return new Date(fechaHora).toLocaleTimeString(
      "es-PE",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Lima",
      }
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-orange-600 to-red-600 p-7 text-white shadow-xl">
        <h1 className="text-3xl font-black">
          🟠 Tardanzas de estudiantes
        </h1>

        <p className="mt-2 text-orange-100">
          Consulta y seguimiento de ingresos tardíos
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-600">
              Fecha
            </label>

            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-600">
              Buscar por DNI
            </label>

            <input
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ingrese DNI"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={cargarTardanzas}
              className="w-full rounded-xl bg-orange-600 px-5 py-3 font-black text-white transition hover:bg-orange-700"
            >
              Buscar tardanzas
            </button>
          </div>
        </div>
      </section>

      {mensaje && (
        <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">
          {mensaje}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Detalle de tardanzas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total encontrado: {tardanzas.length}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[950px] text-left">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-4 py-4">Estudiante</th>
                <th className="px-4 py-4">DNI</th>
                <th className="px-4 py-4">Grado</th>
                <th className="px-4 py-4">Turno</th>
                <th className="px-4 py-4">Entrada</th>
                <th className="px-4 py-4">Demora</th>
                <th className="px-4 py-4">Método</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {tardanzas.map((item, index) => (
                <tr
                  key={item.id}
                  className={
                    index % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50"
                  }
                >
                  <td className="px-4 py-4 font-black text-slate-900">
                    {item.estudiante.nombres}{" "}
                    {item.estudiante.apellidos}
                  </td>

                  <td className="px-4 py-4">
                    {item.estudiante.dni}
                  </td>

                  <td className="px-4 py-4">
                    {item.estudiante.grado} -{" "}
                    {item.estudiante.seccion}
                  </td>

                  <td className="px-4 py-4">
                    {item.estudiante.turno}
                  </td>

                  <td className="px-4 py-4 font-bold">
                    {hora(item.horaEntrada)}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-700">
                      {item.minutosTardanza} min
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    {item.metodo}
                  </td>
                </tr>
              ))}

              {!cargando && tardanzas.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center font-semibold text-slate-500"
                  >
                    No se encontraron tardanzas para la fecha seleccionada.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center font-semibold text-slate-500"
                  >
                    Cargando tardanzas...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}