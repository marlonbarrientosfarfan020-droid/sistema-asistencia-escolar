"use client";

import { useEffect, useMemo, useState } from "react";

type Turno = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
};

type EventoCalendario = {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  tipo: string;
  descripcion: string;
  todosLosTurnos: boolean;
  turnoId: number | null;
  estado: boolean;
  turno?: Turno | null;
};

const TIPOS = [
  "FERIADO",
  "VACACIONES",
  "SUSPENSION",
  "ACTIVIDAD_INSTITUCIONAL",
  "DIA_NO_LECTIVO",
  "OTRO",
];

function fechaSolo(fecha: string) {
  return fecha.slice(0, 10);
}

function fechaInput(fecha: string) {
  return fechaSolo(fecha);
}

function fechaPeru(fecha: string) {
  const [anio, mes, dia] = fechaSolo(fecha).split("-");

  return `${dia}/${mes}/${anio}`;
}
function nombreTipo(tipo: string) {
  const nombres: Record<string, string> = {
    FERIADO: "Feriado",
    VACACIONES: "Vacaciones",
    SUSPENSION: "Suspensión de clases",
    ACTIVIDAD_INSTITUCIONAL: "Actividad institucional",
    DIA_NO_LECTIVO: "Día no lectivo",
    OTRO: "Otro",
  };

  return nombres[tipo] || tipo;
}

function colorTipo(tipo: string) {
  const colores: Record<string, string> = {
    FERIADO: "bg-red-100 text-red-700 border-red-200",
    VACACIONES: "bg-blue-100 text-blue-700 border-blue-200",
    SUSPENSION: "bg-orange-100 text-orange-700 border-orange-200",
    ACTIVIDAD_INSTITUCIONAL:
      "bg-purple-100 text-purple-700 border-purple-200",
    DIA_NO_LECTIVO: "bg-slate-100 text-slate-700 border-slate-200",
    OTRO: "bg-cyan-100 text-cyan-700 border-cyan-200",
  };

  return colores[tipo] || colores.OTRO;
}

function diasDelMes(anio: number, mes: number) {
  const primero = new Date(anio, mes, 1);
  const ultimo = new Date(anio, mes + 1, 0);

  const dias: Array<{
    fecha: Date | null;
    numero: number | null;
  }> = [];

  const inicioSemana = primero.getDay();

  for (let i = 0; i < inicioSemana; i++) {
    dias.push({ fecha: null, numero: null });
  }

  for (let dia = 1; dia <= ultimo.getDate(); dia++) {
    dias.push({
      fecha: new Date(anio, mes, dia),
      numero: dia,
    });
  }

  return dias;
}

export default function CalendarioEscolarPage() {
  const hoy = new Date();

  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());

  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipo, setTipo] = useState("FERIADO");
  const [descripcion, setDescripcion] = useState("");
  const [todosLosTurnos, setTodosLosTurnos] = useState(true);
  const [turnoId, setTurnoId] = useState("");

  const dias = useMemo(() => diasDelMes(anio, mes), [anio, mes]);

  async function cargarEventos() {
    setCargando(true);

    try {
      const res = await fetch(
        `/api/calendario-escolar?anio=${anio}&mes=${mes + 1}`,
        {
          headers: {
            "x-user-role": localStorage.getItem("rol") || "",
            "x-user-name": localStorage.getItem("usuario") || "",
          },
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        setEventos(data);
        setMensaje("");
      } else {
        setEventos([]);
        setMensaje(`❌ ${data.message || "Error al cargar calendario"}`);
      }
    } catch {
      setMensaje("❌ No se pudo conectar con el calendario escolar");
    } finally {
      setCargando(false);
    }
  }

  async function cargarTurnos() {
    try {
      const res = await fetch("/api/turnos", {
        headers: {
          "x-user-role": localStorage.getItem("rol") || "",
          "x-user-name": localStorage.getItem("usuario") || "",
        },
      });

      const data = await res.json();

      setTurnos(Array.isArray(data) ? data : []);
    } catch {
      setTurnos([]);
    }
  }

  useEffect(() => {
    cargarEventos();
  }, [anio, mes]);

  useEffect(() => {
    cargarTurnos();
  }, []);

  function limpiarFormulario() {
    setEditandoId(null);
    setFechaInicio("");
    setFechaFin("");
    setTipo("FERIADO");
    setDescripcion("");
    setTodosLosTurnos(true);
    setTurnoId("");
  }

  async function guardarEvento(e: React.FormEvent) {
    e.preventDefault();

    if (!fechaInicio || !fechaFin || !descripcion.trim()) {
      setMensaje("❌ Complete las fechas y la descripción");
      return;
    }

    if (!todosLosTurnos && !turnoId) {
      setMensaje("❌ Seleccione el turno");
      return;
    }

    const res = await fetch("/api/calendario-escolar", {
      method: editandoId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
      body: JSON.stringify({
        id: editandoId,
        fechaInicio,
        fechaFin,
        tipo,
        descripcion,
        todosLosTurnos,
        turnoId: todosLosTurnos ? null : Number(turnoId),
        estado: true,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje(
        editandoId
          ? "✅ Evento actualizado correctamente"
          : "✅ Evento registrado correctamente"
      );

      limpiarFormulario();
      cargarEventos();
    } else {
      setMensaje(`❌ ${data.message || "Error al guardar evento"}`);
    }
  }

  function editarEvento(evento: EventoCalendario) {
    setEditandoId(evento.id);
    setFechaInicio(fechaInput(evento.fechaInicio));
    setFechaFin(fechaInput(evento.fechaFin));
    setTipo(evento.tipo);
    setDescripcion(evento.descripcion);
    setTodosLosTurnos(evento.todosLosTurnos);
    setTurnoId(evento.turnoId ? String(evento.turnoId) : "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function eliminarEvento(id: number) {
    if (!confirm("¿Eliminar este evento del calendario escolar?")) {
      return;
    }

    const res = await fetch(`/api/calendario-escolar?id=${id}`, {
      method: "DELETE",
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Evento eliminado correctamente");
      cargarEventos();
    } else {
      setMensaje(`❌ ${data.message || "Error al eliminar evento"}`);
    }
  }

  function cambiarMes(cambio: number) {
    const nuevaFecha = new Date(anio, mes + cambio, 1);

    setAnio(nuevaFecha.getFullYear());
    setMes(nuevaFecha.getMonth());
  }

 function eventosDelDia(fecha: Date) {
  const fechaCalendario = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");

  return eventos.filter((evento) => {
    const inicio = fechaSolo(evento.fechaInicio);
    const fin = fechaSolo(evento.fechaFin);

    return (
      evento.estado &&
      fechaCalendario >= inicio &&
      fechaCalendario <= fin
    );
  });
}

  const nombreMes = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(new Date(anio, mes, 1));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-extrabold">
          📅 Calendario Escolar
        </h1>

        <p className="text-red-100 mt-2">
          Configura feriados, vacaciones, suspensiones y días sin clases.
        </p>
      </div>

      {mensaje && (
        <div className="bg-white rounded-2xl p-4 shadow font-bold">
          {mensaje}
        </div>
      )}

      <div className="bg-white rounded-3xl shadow p-6">
        <h2 className="text-2xl font-bold mb-5">
          {editandoId ? "✏️ Editar evento" : "➕ Registrar día no lectivo"}
        </h2>

        <form
          onSubmit={guardarEvento}
          className="grid md:grid-cols-2 gap-5"
        >
          <div>
            <label className="block font-bold mb-2">Fecha de inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="border rounded-xl p-3 w-full"
            />
          </div>

          <div>
            <label className="block font-bold mb-2">Fecha final</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="border rounded-xl p-3 w-full"
            />
          </div>

          <div>
            <label className="block font-bold mb-2">Tipo de evento</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="border rounded-xl p-3 w-full"
            >
              {TIPOS.map((item) => (
                <option key={item} value={item}>
                  {nombreTipo(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-2">Aplicación</label>

            <select
              value={todosLosTurnos ? "TODOS" : "TURNO"}
              onChange={(e) => {
                const todos = e.target.value === "TODOS";
                setTodosLosTurnos(todos);

                if (todos) {
                  setTurnoId("");
                }
              }}
              className="border rounded-xl p-3 w-full"
            >
              <option value="TODOS">Todos los turnos</option>
              <option value="TURNO">Solo un turno</option>
            </select>
          </div>

          {!todosLosTurnos && (
            <div>
              <label className="block font-bold mb-2">Turno</label>

              <select
                value={turnoId}
                onChange={(e) => setTurnoId(e.target.value)}
                className="border rounded-xl p-3 w-full"
              >
                <option value="">Seleccione turno</option>

                {turnos.map((turno) => (
                  <option key={turno.id} value={turno.id}>
                    {turno.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={todosLosTurnos ? "md:col-span-2" : ""}>
            <label className="block font-bold mb-2">Descripción</label>

            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ejemplo: Fiestas Patrias"
              className="border rounded-xl p-3 w-full"
            />
          </div>

          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold"
            >
              {editandoId ? "Actualizar evento" : "Guardar evento"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl shadow p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={() => cambiarMes(-1)}
            className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold"
          >
            ← Anterior
          </button>

          <h2 className="text-3xl font-extrabold capitalize">
            {nombreMes}
          </h2>

          <button
            onClick={() => cambiarMes(1)}
            className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold"
          >
            Siguiente →
          </button>
        </div>

        {cargando && (
          <div className="text-blue-700 font-bold mb-4">
            Cargando calendario...
          </div>
        )}

        <div className="grid grid-cols-7 border-l border-t">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
            (dia) => (
              <div
                key={dia}
                className="border-r border-b bg-slate-100 p-3 text-center font-bold"
              >
                {dia}
              </div>
            )
          )}

          {dias.map((item, index) => {
            if (!item.fecha || !item.numero) {
              return (
                <div
                  key={`vacio-${index}`}
                  className="min-h-[120px] border-r border-b bg-slate-50"
                />
              );
            }

            const eventosDia = eventosDelDia(item.fecha);

            return (
              <div
                key={item.fecha.toISOString()}
                className={`min-h-[120px] border-r border-b p-2 ${
                  eventosDia.length > 0 ? "bg-red-50" : "bg-white"
                }`}
              >
                <div className="font-bold text-lg">{item.numero}</div>

                <div className="space-y-1 mt-2">
                  {eventosDia.map((evento) => (
                    <button
                      key={evento.id}
                      onClick={() => editarEvento(evento)}
                      className={`block w-full text-left border rounded-lg px-2 py-1 text-xs font-bold ${colorTipo(
                        evento.tipo
                      )}`}
                      title={evento.descripcion}
                    >
                      {nombreTipo(evento.tipo)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow p-6">
        <h2 className="text-2xl font-bold mb-5">
          📋 Eventos registrados
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b">
                <th className="py-3">Fechas</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Aplicación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {eventos.map((evento) => (
                <tr key={evento.id} className="border-b">
                  <td className="py-3">
                    {fechaPeru(evento.fechaInicio)}
                    {fechaInput(evento.fechaInicio) !==
                      fechaInput(evento.fechaFin) &&
                      ` al ${fechaPeru(evento.fechaFin)}`}
                  </td>

                  <td>
                    <span
                      className={`inline-block border rounded-full px-3 py-1 text-sm font-bold ${colorTipo(
                        evento.tipo
                      )}`}
                    >
                      {nombreTipo(evento.tipo)}
                    </span>
                  </td>

                  <td>{evento.descripcion}</td>

                  <td>
                    {evento.todosLosTurnos
                      ? "Todos los turnos"
                      : evento.turno?.nombre || "Turno no disponible"}
                  </td>

                  <td>{evento.estado ? "✅ Activo" : "❌ Inactivo"}</td>

                  <td className="py-2 flex gap-2">
                    <button
                      onClick={() => editarEvento(evento)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarEvento(evento.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {eventos.length === 0 && !cargando && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500"
                  >
                    No hay eventos registrados en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}