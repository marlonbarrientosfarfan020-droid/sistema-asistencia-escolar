"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";

type Turno = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
};

type Estudiante = {
  id: number;
  codigo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;
  nombreTutor: string;
  whatsapp: string;
  telegramChatId: string;
  turnoId: number | null;
  turno?: Turno | null;
  riesgoIA?: {
    nivel: string;
    porcentaje: number;
    resumen: string;
    recomendacion: string;
  } | null;
};

export default function EstudianteTable({ refresh }: { refresh: number }) {
  const { configuracion } = useConfiguracionColegio();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [busquedaDni, setBusquedaDni] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Estudiante | null>(null);
  const [modalQR, setModalQR] = useState(false);
  const [qrImagen, setQrImagen] = useState("");
  const [estudianteQR, setEstudianteQR] = useState<Estudiante | null>(null);
  const [turnoFiltro, setTurnoFiltro] = useState("TODOS");
  const [modalRiesgo, setModalRiesgo] = useState(false);
const [riesgoSeleccionado, setRiesgoSeleccionado] = useState<Estudiante | null>(null);

  const estudiantesFiltrados = estudiantes.filter((estudiante) => {
    const coincideDni = estudiante.dni.includes(busquedaDni);
    const coincideTurno =
      turnoFiltro === "TODOS" ? true : estudiante.turno?.nombre === turnoFiltro;

    return coincideDni && coincideTurno;
  });
  async function analizarRiesgoIA(dni: string) {
  setMensaje("🧠 Analizando riesgo del estudiante...");

  const res = await fetch("/api/ia/riesgo-estudiante", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dni }),
  });

  const data = await res.json();

  if (res.ok) {
    setMensaje("✅ Riesgo IA actualizado correctamente");
    cargarEstudiantes();
  } else {
    setMensaje(`❌ ${data.message || "Error al analizar riesgo IA"}`);
  }
}

  async function cargarEstudiantes() {
    const res = await fetch("/api/estudiantes", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
    });

    const data = await res.json();

    if (Array.isArray(data)) {
      setEstudiantes(data);
    } else {
      setEstudiantes([]);
      setMensaje(`❌ ${data.message || "No autorizado"}`);
    }
  }

  async function cargarTurnos() {
    const res = await fetch("/api/turnos", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
    });

    const data = await res.json();

    if (Array.isArray(data)) {
      setTurnos(data);
    } else {
      setTurnos([]);
    }
  }

  useEffect(() => {
    cargarEstudiantes();
    cargarTurnos();
  }, [refresh]);

  function abrirEditar(estudiante: Estudiante) {
    setEditando({
      ...estudiante,
      turnoId: estudiante.turnoId ?? estudiante.turno?.id ?? null,
    });
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    if (!editando) return;

    const { name, value } = e.target;

    if (name === "dni") {
      setEditando({ ...editando, dni: value.replace(/\D/g, "").slice(0, 8) });
      return;
    }

    if (name === "whatsapp") {
      setEditando({
        ...editando,
        whatsapp: value.replace(/\D/g, "").slice(0, 12),
      });
      return;
    }

    if (name === "telegramChatId") {
      setEditando({
        ...editando,
        telegramChatId: value.replace(/\D/g, "").slice(0, 20),
      });
      return;
    }

    if (name === "turnoId") {
      setEditando({
        ...editando,
        turnoId: value ? Number(value) : null,
      });
      return;
    }

    setEditando({ ...editando, [name]: value });
  }

  async function actualizarEstudiante(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;

    const res = await fetch("/api/estudiantes", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
      body: JSON.stringify({
        ...editando,
        turnoId: editando.turnoId ? Number(editando.turnoId) : null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✏️ Estudiante actualizado correctamente");
      cerrarModal();
      cargarEstudiantes();
    } else {
      setMensaje(`❌ ${data.message || "Error al actualizar estudiante"}`);
    }
  }

  async function eliminarEstudiante(id: number) {
    if (!confirm("¿Seguro que deseas eliminar este estudiante?")) return;

    const res = await fetch(`/api/estudiantes?id=${id}`, {
      method: "DELETE",
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("🗑️ Estudiante eliminado correctamente");
      cargarEstudiantes();
    } else {
      setMensaje(`❌ ${data.message || "Error al eliminar estudiante"}`);
    }
  }

  async function verQR(estudiante: Estudiante) {
    const qr = await QRCode.toDataURL(estudiante.codigo);
    setQrImagen(qr);
    setEstudianteQR(estudiante);
    setModalQR(true);
  }
  function mostrarRiesgo(estudiante: Estudiante) {
  const riesgo = estudiante.riesgoIA;

  if (!riesgo) {
    return (
      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold">
        Sin análisis
      </span>
    );
  }

  const nivel = riesgo.nivel.toUpperCase();

  if (nivel === "ALTO") {
    return (
      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">
        🔴 Alto {riesgo.porcentaje}%
      </span>
    );
  }

  if (nivel === "MEDIO") {
    return (
      <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">
        🟠 Medio {riesgo.porcentaje}%
      </span>
    );
  }

  return (
    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
      🟢 Bajo {riesgo.porcentaje}%
    </span>
  );
}
  
async function convertirImagenADataUrl(url: string): Promise<string> {
  try {
    const respuesta = await fetch(url, {
      cache: "no-store",
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo descargar el logo");
    }

    const blob = await respuesta.blob();

    return await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();

      lector.onloadend = () => {
        if (typeof lector.result === "string") {
          resolve(lector.result);
        } else {
          reject(new Error("No se pudo convertir el logo"));
        }
      };

      lector.onerror = () => {
        reject(new Error("No se pudo leer el logo"));
      };

      lector.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error preparando logo para impresión:", error);

    return `${window.location.origin}/img/logo-santa-rita.png`;
  }
}
 async function imprimirQR() {
  if (!estudianteQR || !qrImagen) return;

  const logoOriginal =
    configuracion.logoUrl?.trim() ||
    `${window.location.origin}/img/logo-santa-rita.png`;

  const logoParaImprimir =
    await convertirImagenADataUrl(logoOriginal);

  const nombreColegio =
    configuracion.nombreColegio?.trim() ||
    "I.E. Santa Rita de Casia";

  const ventana = window.open("", "_blank");

  if (!ventana) {
    setMensaje(
      "❌ Permita las ventanas emergentes para imprimir el carnet"
    );
    return;
  }

    ventana.document.write(`
      <html>
        <head>
          <title>Carnet QR Estudiante</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #f1f5f9;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .carnet {
              width: 360px;
              background: white;
              border-radius: 24px;
              overflow: hidden;
              box-shadow: 0 15px 35px rgba(0,0,0,0.25);
              border: 2px solid #0f172a;
            }
            .header {
              background: linear-gradient(135deg, #0f172a, #1d4ed8);
              color: white;
              text-align: center;
              padding: 18px;
            }
            .logo {
              width: 85px;
              height: 85px;
              object-fit: contain;
              background: white;
              border-radius: 14px;
              padding: 6px;
              margin-bottom: 8px;
            }
            .colegio { font-size: 18px; font-weight: bold; }
            .subtitulo { font-size: 12px; margin-top: 4px; opacity: 0.9; }
            .contenido { padding: 22px; text-align: center; }
            .nombre {
              font-size: 22px;
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 8px;
            }
            .dato {
              font-size: 14px;
              margin: 6px 0;
              color: #334155;
            }
            .qr {
              width: 210px;
              height: 210px;
              margin-top: 15px;
            }
            .footer {
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              text-align: center;
              padding: 12px;
              font-size: 12px;
              color: #475569;
            }
            @media print {
              body { background: white; }
              .carnet { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="carnet">
            <div class="header">
  <img
    id="logo-colegio"
    class="logo"
    src="${logoParaImprimir}"
    alt="Logo institucional"
  />

  <div class="colegio">
    ${nombreColegio}
  </div>

  <div class="subtitulo">
    Carnet de Asistencia Escolar
  </div>
</div>

            <div class="contenido">
              <div class="nombre">
                ${estudianteQR.nombres} ${estudianteQR.apellidos}
              </div>

              <div class="dato"><strong>DNI:</strong> ${estudianteQR.dni}</div>
              <div class="dato"><strong>Grado:</strong> ${estudianteQR.grado} - ${estudianteQR.seccion}</div>
              <div class="dato"><strong>Turno:</strong> ${estudianteQR.turno?.nombre || "Sin turno"}</div>
              <div class="dato"><strong>Código:</strong> ${estudianteQR.codigo}</div>

              <img class="qr" src="${qrImagen}" />
            </div>

            <div class="footer">
              Presentar este QR para registrar asistencia
            </div>
          </div>

          <script>
  function esperarImagen(imagen) {
    return new Promise(function(resolve) {
      if (!imagen) {
        resolve();
        return;
      }

      if (imagen.complete && imagen.naturalWidth > 0) {
        resolve();
        return;
      }

      imagen.onload = function() {
        resolve();
      };

      imagen.onerror = function() {
        resolve();
      };
    });
  }

  window.onload = async function() {
    const logo = document.getElementById("logo-colegio");
    const qr = document.querySelector(".qr");

    await Promise.all([
      esperarImagen(logo),
      esperarImagen(qr)
    ]);

    setTimeout(function() {
      window.focus();
      window.print();
    }, 300);
  };
</script>
        </body>
      </html>
    `);

    ventana.document.close();
  }

  return (
    <>
      <Card>
        <div className="flex items-center gap-3">
          <input
            value={busquedaDni}
            onChange={(e) =>
              setBusquedaDni(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="🔍 Buscar por DNI"
            className="border rounded-xl p-3 w-72"
          />

          <select
            value={turnoFiltro}
            onChange={(e) => setTurnoFiltro(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="TODOS">Todos los turnos</option>
            {turnos.map((turno) => (
              <option key={turno.id} value={turno.nombre}>
                {turno.nombre}
              </option>
            ))}
          </select>
        </div>

        {mensaje && <p className="mb-4 mt-4 font-bold">{mensaje}</p>}

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="border-b">
                <th className="py-3">Código</th>
                <th>DNI</th>
                <th>Estudiante</th>
                <th>Grado</th>
                <th>Sección</th>
                <th>Turno</th>
                <th>Riesgo IA</th>
                <th>Tutor</th>
                <th>WhatsApp</th>
                <th>Telegram</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {estudiantesFiltrados.map((estudiante) => (
                <tr key={estudiante.id} className="border-b">
                  <td className="py-3">{estudiante.codigo}</td>
                  <td>{estudiante.dni}</td>
                  <td>
                    {estudiante.nombres} {estudiante.apellidos}
                  </td>
                  <td>{estudiante.grado}</td>
                  <td>{estudiante.seccion}</td>
                  <td>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                      {estudiante.turno?.nombre || "Sin turno"}
                    </span>
                  </td>
                  <td>{mostrarRiesgo(estudiante)}</td>
                  <td>{estudiante.nombreTutor}</td>
                  <td>{estudiante.whatsapp}</td>
                  <td>{estudiante.telegramChatId || "No registrado"}</td>

                  <td className="flex gap-2 py-2">
                    <button
                      onClick={() => verQR(estudiante)}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold"
                    >
                      QR
                    </button>
                    <button
  onClick={() => analizarRiesgoIA(estudiante.dni)}
  className="bg-purple-600 text-white px-3 py-2 rounded-lg font-bold"
>
  IA
</button>


                    <button
                      onClick={() => abrirEditar(estudiante)}
                      className="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarEstudiante(estudiante.id)}
                      className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold"
                    >
                      Eliminar
                    </button>
                    <button
  onClick={() => {
    setRiesgoSeleccionado(estudiante);
    setModalRiesgo(true);
  }}
  className="bg-slate-700 text-white px-3 py-2 rounded-lg font-bold"
>
  Ver riesgo
</button>
                  </td>
                </tr>
              ))}

              {estudiantesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-500">
                    No se encontraron estudiantes con ese DNI.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        abierto={modalQR}
        titulo="Código QR del estudiante"
        onCerrar={() => setModalQR(false)}
      >
        {estudianteQR && (
          <div className="text-center">
            <h3 className="text-xl font-bold">
              {estudianteQR.nombres} {estudianteQR.apellidos}
            </h3>

            <p className="text-slate-600 mt-1">
              Código: {estudianteQR.codigo}
            </p>

            <p className="text-slate-600 mt-1">
              Turno: {estudianteQR.turno?.nombre || "Sin turno"}
            </p>

            {qrImagen && (
              <img
                src={qrImagen}
                alt="Código QR"
                className="mx-auto mt-6 w-64 h-64"
              />
            )}

            <button
              onClick={() => imprimirQR()}
              className="mt-6 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold"
            >
              Imprimir QR
            </button>
            
          </div>
        )}
      </Modal>
      <Modal
  abierto={modalRiesgo}
  titulo="🧠 Análisis Inteligente del Estudiante"
  onCerrar={() => setModalRiesgo(false)}
>
  {riesgoSeleccionado && (
    <div className="space-y-5">

      <div className="bg-slate-100 rounded-xl p-4">
        <h3 className="font-bold text-xl">
          {riesgoSeleccionado.nombres} {riesgoSeleccionado.apellidos}
        </h3>

        <p>DNI: {riesgoSeleccionado.dni}</p>

        <p>
          {riesgoSeleccionado.grado} - {riesgoSeleccionado.seccion}
        </p>
      </div>

      {riesgoSeleccionado.riesgoIA ? (
        <>
          <div className="grid grid-cols-2 gap-4">

            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-slate-500">Nivel</p>

              <h2 className="text-3xl font-bold">
                {riesgoSeleccionado.riesgoIA.nivel}
              </h2>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-slate-500">Probabilidad</p>

              <h2 className="text-3xl font-bold">
                {riesgoSeleccionado.riesgoIA.porcentaje}%
              </h2>
            </div>

          </div>

          <div className="bg-white border rounded-xl p-5">
            <h3 className="font-bold text-lg mb-2">
              📋 Resumen IA
            </h3>

            <p className="whitespace-pre-wrap">
              {riesgoSeleccionado.riesgoIA.resumen}
            </p>
          </div>

          <div className="bg-green-50 border rounded-xl p-5">
            <h3 className="font-bold text-lg mb-2">
              ✅ Recomendaciones
            </h3>

            <p className="whitespace-pre-wrap">
              {riesgoSeleccionado.riesgoIA.recomendacion}
            </p>
          </div>
        </>
      ) : (
        <div className="bg-yellow-50 border rounded-xl p-6 text-center">
          Este estudiante todavía no tiene un análisis IA.

          <br />

          Presiona el botón <b>IA</b> para generarlo.
        </div>
      )}

    </div>
  )}
</Modal>

      <Modal
        abierto={modalAbierto}
        titulo="Editar estudiante"
        onCerrar={cerrarModal}
      >
        {editando && (
          <form
            onSubmit={actualizarEstudiante}
            className="grid grid-cols-2 gap-5"
          >
            <Input name="codigo" value={editando.codigo} onChange={handleChange} placeholder="Código" />
            <Input name="dni" value={editando.dni} onChange={handleChange} placeholder="DNI" />
            <Input name="nombres" value={editando.nombres} onChange={handleChange} placeholder="Nombres" />
            <Input name="apellidos" value={editando.apellidos} onChange={handleChange} placeholder="Apellidos" />
            <Input name="grado" value={editando.grado} onChange={handleChange} placeholder="Grado" />
            <Input name="seccion" value={editando.seccion} onChange={handleChange} placeholder="Sección" />
            <Input name="nombreTutor" value={editando.nombreTutor} onChange={handleChange} placeholder="Nombre del tutor" />
            <Input name="whatsapp" value={editando.whatsapp} onChange={handleChange} placeholder="WhatsApp del tutor" />

            <Input
              name="telegramChatId"
              value={editando.telegramChatId || ""}
              onChange={handleChange}
              placeholder="Telegram Chat ID del tutor"
            />

            <select
              name="turnoId"
              value={editando.turnoId || ""}
              onChange={handleChange}
              className="border rounded-xl p-3 w-full"
            >
              <option value="">Seleccione turno</option>
              {turnos.map((turno) => (
                <option key={turno.id} value={turno.id}>
                  {turno.nombre} ({turno.horaEntrada} - {turno.horaSalida})
                </option>
              ))}
            </select>

            <Button
              type="button"
              onClick={cerrarModal}
              className="bg-slate-200 text-slate-900"
            >
              Cancelar
            </Button>
            

            <Button type="submit" className="bg-blue-600 text-white">
              Actualizar
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}