"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";

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
};

export default function EstudianteTable({ refresh }: { refresh: number }) {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [busquedaDni, setBusquedaDni] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Estudiante | null>(null);

  const [modalQR, setModalQR] = useState(false);
  const [qrImagen, setQrImagen] = useState("");
  const [estudianteQR, setEstudianteQR] = useState<Estudiante | null>(null);

  const estudiantesFiltrados = estudiantes.filter((estudiante) =>
    estudiante.dni.includes(busquedaDni)
  );

  async function cargarEstudiantes() {
    const res = await fetch("/api/estudiantes");
    const data = await res.json();
    setEstudiantes(data);
  }

  useEffect(() => {
    cargarEstudiantes();
  }, [refresh]);

  function abrirEditar(estudiante: Estudiante) {
    setEditando(estudiante);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    setEditando({ ...editando, [name]: value });
  }

  async function actualizarEstudiante(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;

    const res = await fetch("/api/estudiantes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editando),
    });

    if (res.ok) {
      setMensaje("✏️ Estudiante actualizado correctamente");
      cerrarModal();
      cargarEstudiantes();
    } else {
      setMensaje("❌ Error al actualizar estudiante");
    }
  }

  async function eliminarEstudiante(id: number) {
    if (!confirm("¿Seguro que deseas eliminar este estudiante?")) return;

    const res = await fetch(`/api/estudiantes?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setMensaje("🗑️ Estudiante eliminado correctamente");
      cargarEstudiantes();
    } else {
      setMensaje("❌ Error al eliminar estudiante");
    }
  }

  async function verQR(estudiante: Estudiante) {
    const qr = await QRCode.toDataURL(estudiante.codigo);
    setQrImagen(qr);
    setEstudianteQR(estudiante);
    setModalQR(true);
  }
function imprimirQR() {
  if (!estudianteQR || !qrImagen) return;

  const ventana = window.open("", "_blank");

  if (!ventana) return;

  ventana.document.write(`
    <html>
      <head>
        <title>Carnet QR Estudiante</title>
        <style>
          * {
            box-sizing: border-box;
          }

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

          .colegio {
            font-size: 18px;
            font-weight: bold;
          }

          .subtitulo {
            font-size: 12px;
            margin-top: 4px;
            opacity: 0.9;
          }

          .contenido {
            padding: 22px;
            text-align: center;
          }

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
            body {
              background: white;
            }

            .carnet {
              box-shadow: none;
            }
          }
        </style>
      </head>

      <body>
        <div class="carnet">
          <div class="header">
            <img class="logo" src="/img/logo-santa-rita.png" />
            <div class="colegio">I.E. Santa Rita de Casia</div>
            <div class="subtitulo">Carnet de Asistencia Escolar</div>
          </div>

          <div class="contenido">
            <div class="nombre">
              ${estudianteQR.nombres} ${estudianteQR.apellidos}
            </div>

            <div class="dato"><strong>DNI:</strong> ${estudianteQR.dni}</div>
            <div class="dato"><strong>Grado:</strong> ${estudianteQR.grado} - ${estudianteQR.seccion}</div>
            <div class="dato"><strong>Código:</strong> ${estudianteQR.codigo}</div>

            <img class="qr" src="${qrImagen}" />
          </div>

          <div class="footer">
            Presentar este QR para registrar entrada y salida
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `);

  ventana.document.close();
}
  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold">Lista de estudiantes</h3>

          <input
            value={busquedaDni}
            onChange={(e) =>
              setBusquedaDni(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="🔍 Buscar por DNI"
            className="border rounded-xl p-3 w-72"
          />
        </div>

        {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-3">Código</th>
              <th>DNI</th>
              <th>Estudiante</th>
              <th>Grado</th>
              <th>Sección</th>
              <th>Tutor</th>
              <th>WhatsApp</th>
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
                <td>{estudiante.nombreTutor}</td>
                <td>{estudiante.whatsapp}</td>

                <td className="flex gap-2 py-2">
                  <button
                    onClick={() => verQR(estudiante)}
                    className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold"
                  >
                    QR
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
                </td>
              </tr>
            ))}

            {estudiantesFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500">
                  No se encontraron estudiantes con ese DNI.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

            <Button type="button" onClick={cerrarModal} className="bg-slate-200 text-slate-900">
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