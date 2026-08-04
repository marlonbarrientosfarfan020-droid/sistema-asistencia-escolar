"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";

type Turno = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  estado: boolean;
  minutosAlertaInicial: number;
  margenAlertaMinutos: number;
  margenEntradaAnticipadaMinutos: number;
  margenSalidaMinutos: number;
};

export default function TurnoTable({
  refresh,
}: {
  refresh: number;
}) {
  const [turnos, setTurnos] = useState<Turno[]>(
    []
  );

  const [mensaje, setMensaje] = useState("");
  const [guardandoId, setGuardandoId] =
    useState<number | null>(null);

  async function cargarTurnos() {
    setMensaje("");

    try {
      const res = await fetch("/api/turnos", {
        cache: "no-store",
        credentials: "include",

        headers: {
          "x-user-role":
            localStorage.getItem("rol") || "",
        },
      });

      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        setTurnos([]);

        setMensaje(
          `❌ ${
            data.message ||
            "No se pudieron cargar los turnos"
          }`
        );

        return;
      }

      setTurnos(
        data.map((turno) => ({
          ...turno,

          minutosAlertaInicial:
            Number(
              turno.minutosAlertaInicial
            ) || 5,

          margenAlertaMinutos:
            Number(
              turno.margenAlertaMinutos
            ) || 15,

          margenEntradaAnticipadaMinutos:
            Number(
              turno.margenEntradaAnticipadaMinutos
            ) || 60,

          margenSalidaMinutos:
            Number(
              turno.margenSalidaMinutos
            ) || 60,
        }))
      );
    } catch (error) {
      console.error(
        "Error cargando turnos:",
        error
      );

      setTurnos([]);

      setMensaje(
        "❌ Error al conectar con el servidor"
      );
    }
  }

  useEffect(() => {
    void cargarTurnos();
  }, [refresh]);

  function cambiarValor<K extends keyof Turno>(
    id: number,
    campo: K,
    valor: Turno[K]
  ) {
    setTurnos((lista) =>
      lista.map((turno) =>
        turno.id === id
          ? {
              ...turno,
              [campo]: valor,
            }
          : turno
      )
    );
  }

  function validarTurno(turno: Turno) {
    if (!turno.nombre.trim()) {
      return "El nombre del turno es obligatorio";
    }

    if (!turno.horaEntrada) {
      return "Ingrese la hora de entrada";
    }

    if (!turno.horaSalida) {
      return "Ingrese la hora de salida";
    }

    if (
      turno.margenEntradaAnticipadaMinutos < 0 ||
      turno.margenEntradaAnticipadaMinutos > 180
    ) {
      return "La entrada anticipada debe estar entre 0 y 180 minutos";
    }

    if (
      turno.minutosAlertaInicial < 0 ||
      turno.minutosAlertaInicial > 180
    ) {
      return "El aviso inicial debe estar entre 0 y 180 minutos";
    }

    if (
      turno.margenAlertaMinutos < 0 ||
      turno.margenAlertaMinutos > 180
    ) {
      return "El margen de tardanza debe estar entre 0 y 180 minutos";
    }

    if (
      turno.margenSalidaMinutos < 0 ||
      turno.margenSalidaMinutos > 180
    ) {
      return "El margen de salida debe estar entre 0 y 180 minutos";
    }

    if (
      turno.minutosAlertaInicial >=
      turno.margenAlertaMinutos
    ) {
      return "El aviso inicial debe ocurrir antes del margen de tardanza";
    }

    return "";
  }

  async function guardarTurno(
    turno: Turno
  ) {
    const errorValidacion =
      validarTurno(turno);

    if (errorValidacion) {
      setMensaje(`❌ ${errorValidacion}`);
      return;
    }

    setGuardandoId(turno.id);
    setMensaje("");

    try {
      const res = await fetch(
        "/api/turnos",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            "x-user-role":
              localStorage.getItem("rol") ||
              "",
          },

          credentials: "include",

          body: JSON.stringify({
            id: turno.id,
            nombre: turno.nombre.trim(),
            horaEntrada:
              turno.horaEntrada,

            margenEntradaAnticipadaMinutos:
              Number(
                turno.margenEntradaAnticipadaMinutos
              ),

            minutosAlertaInicial:
              Number(
                turno.minutosAlertaInicial
              ),
            margenAlertaMinutos:
              Number(
                turno.margenAlertaMinutos
              ),
            horaSalida:
              turno.horaSalida,

            margenSalidaMinutos:
              Number(
                turno.margenSalidaMinutos
              ),

            estado: turno.estado,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMensaje(
          `❌ ${
            data.message ||
            "Error al actualizar turno"
          }`
        );

        return;
      }

      setMensaje(
        "✅ Turno actualizado correctamente"
      );

      await cargarTurnos();
    } catch (error) {
      console.error(
        "Error guardando turno:",
        error
      );

      setMensaje(
        "❌ Error al conectar con el servidor"
      );
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <Card>
      <h3 className="mb-2 text-xl font-bold">
        Lista de turnos
      </h3>

      <p className="mb-5 text-sm leading-6 text-slate-500">
        Configure la ventana completa de cada turno:
        cuánto antes puede ingresar el estudiante,
        cuándo se envía el aviso inicial, desde qué
        momento se considera tardanza, la hora de
        salida y cuánto tiempo adicional tendrá para
        registrar su salida.
      </p>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-black text-emerald-800">
            🟢 Entrada anticipada
          </p>

          <p className="mt-1 text-sm text-emerald-700">
            Permite marcar antes de la hora oficial
            del turno.
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="font-black text-yellow-800">
            🟡 Aviso inicial
          </p>

          <p className="mt-1 text-sm text-yellow-700">
            Se envía mientras el estudiante
            continúa dentro del margen permitido.
          </p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="font-black text-orange-800">
            🟠 Margen de tardanza
          </p>

          <p className="mt-1 text-sm text-orange-700">
            Al superar este límite, la entrada
            será registrada como TARDE.
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-black text-red-800">
            🔴 Ausencia confirmada
          </p>

          <p className="mt-1 text-sm text-red-700">
            Se confirma al llegar la hora de
            salida si nunca registró ingreso.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-black text-blue-800">
            🔵 Margen de salida
          </p>

          <p className="mt-1 text-sm text-blue-700">
            Tiempo adicional después de la hora
            oficial para registrar la salida.
          </p>
        </div>
      </div>

      {mensaje && (
        <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold">
          {mensaje}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1580px] text-left">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-3">
                Turno
              </th>

              <th className="px-2 py-3">
                Hora entrada
              </th>

              <th className="px-2 py-3">
                Entrada anticipada
              </th>

              <th className="px-2 py-3">
                Aviso inicial
              </th>

              <th className="px-2 py-3">
                Margen tardanza
              </th>

              <th className="px-2 py-3">
                Hora salida
              </th>

              <th className="px-2 py-3">
                Margen salida
              </th>

              <th className="px-2 py-3">
                Estado
              </th>

              <th className="px-2 py-3">
                Acción
              </th>
            </tr>
          </thead>

          <tbody>
            {turnos.map((turno) => (
              <tr
                key={turno.id}
                className="border-b"
              >
                <td className="px-2 py-3">
                  <input
                    value={turno.nombre}
                    onChange={(e) =>
                      cambiarValor(
                        turno.id,
                        "nombre",
                        e.target.value
                      )
                    }
                    className="w-full min-w-[190px] rounded-xl border p-3"
                  />
                </td>

                <td className="px-2 py-3">
                  <input
                    type="time"
                    value={
                      turno.horaEntrada
                    }
                    onChange={(e) =>
                      cambiarValor(
                        turno.id,
                        "horaEntrada",
                        e.target.value
                      )
                    }
                    className="rounded-xl border p-3"
                  />
                </td>

                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={
                        turno.margenEntradaAnticipadaMinutos
                      }
                      onChange={(e) =>
                        cambiarValor(
                          turno.id,
                          "margenEntradaAnticipadaMinutos",
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-24 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-center font-bold"
                    />

                    <span className="text-sm font-bold text-slate-500">
                      min
                    </span>
                  </div>
                </td>

                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={
                        turno.minutosAlertaInicial
                      }
                      onChange={(e) =>
                        cambiarValor(
                          turno.id,
                          "minutosAlertaInicial",
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-24 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-center font-bold"
                    />

                    <span className="text-sm font-bold text-slate-500">
                      min
                    </span>
                  </div>
                </td>

                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={240}
                      value={
                        turno.margenAlertaMinutos
                      }
                      onChange={(e) =>
                        cambiarValor(
                          turno.id,
                          "margenAlertaMinutos",
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-24 rounded-xl border border-orange-300 bg-orange-50 p-3 text-center font-bold"
                    />

                    <span className="text-sm font-bold text-slate-500">
                      min
                    </span>
                  </div>
                </td>

                <td className="px-2 py-3">
                  <input
                    type="time"
                    value={
                      turno.horaSalida
                    }
                    onChange={(e) =>
                      cambiarValor(
                        turno.id,
                        "horaSalida",
                        e.target.value
                      )
                    }
                    className="rounded-xl border p-3"
                  />
                </td>

                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={
                        turno.margenSalidaMinutos
                      }
                      onChange={(e) =>
                        cambiarValor(
                          turno.id,
                          "margenSalidaMinutos",
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-24 rounded-xl border border-blue-300 bg-blue-50 p-3 text-center font-bold"
                    />

                    <span className="text-sm font-bold text-slate-500">
                      min
                    </span>
                  </div>
                </td>

                <td className="px-2 py-3">
                  <select
                    value={
                      turno.estado
                        ? "true"
                        : "false"
                    }
                    onChange={(e) =>
                      cambiarValor(
                        turno.id,
                        "estado",
                        e.target.value ===
                          "true"
                      )
                    }
                    className="rounded-xl border p-3"
                  >
                    <option value="true">
                      Activo
                    </option>

                    <option value="false">
                      Inactivo
                    </option>
                  </select>
                </td>

                <td className="px-2 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      void guardarTurno(
                        turno
                      )
                    }
                    disabled={
                      guardandoId ===
                      turno.id
                    }
                    className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {guardandoId ===
                    turno.id
                      ? "Guardando..."
                      : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}

            {turnos.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="py-8 text-center text-slate-500"
                >
                  No hay turnos disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}