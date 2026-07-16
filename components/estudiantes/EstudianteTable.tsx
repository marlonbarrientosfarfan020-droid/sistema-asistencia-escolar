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
  const [estudiantesSeleccionados, setEstudiantesSeleccionados] = useState<number[]>([]);

  const estudiantesFiltrados = estudiantes.filter((estudiante) => {
    const coincideDni = estudiante.dni.includes(busquedaDni);
    const coincideTurno =
      turnoFiltro === "TODOS" ? true : estudiante.turno?.nombre === turnoFiltro;

    return coincideDni && coincideTurno;
  });

  const todosFiltradosSeleccionados =
    estudiantesFiltrados.length > 0 &&
    estudiantesFiltrados.every((estudiante) =>
      estudiantesSeleccionados.includes(estudiante.id)
    );

  function alternarSeleccionEstudiante(id: number) {
    setEstudiantesSeleccionados((actuales) =>
      actuales.includes(id)
        ? actuales.filter((estudianteId) => estudianteId !== id)
        : [...actuales, id]
    );
  }

  function alternarSeleccionTodos() {
    const idsFiltrados = estudiantesFiltrados.map(
      (estudiante) => estudiante.id
    );

    setEstudiantesSeleccionados((actuales) => {
      if (todosFiltradosSeleccionados) {
        return actuales.filter((id) => !idsFiltrados.includes(id));
      }

      return Array.from(new Set([...actuales, ...idsFiltrados]));
    });
  }

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
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Carnet QR Estudiante</title>

        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html,
          body {
            margin: 0;
            min-height: 100%;
            font-family: Arial, sans-serif;
            background: #e2e8f0;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12mm;
          }

          .carnet {
            width: 54mm;
            height: 86mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border: 0.35mm solid #1e3a8a;
            border-radius: 4mm;
            background: #ffffff;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
          }

          .header {
            height: 22mm;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            background: linear-gradient(
              180deg,
              #1e3a8a 0%,
              #2563eb 100%
            );
          }

          .logo {
            width: 10mm;
            height: 10mm;
            object-fit: contain;
            padding: 0.8mm;
            margin-bottom: 0.7mm;
            border-radius: 2mm;
            background: #ffffff;
          }

          .colegio {
            max-width: 49mm;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            font-size: 2.8mm;
            line-height: 3.1mm;
            font-weight: 800;
            text-transform: uppercase;
          }

          .subtitulo {
            margin-top: 0.2mm;
            font-size: 1.55mm;
            line-height: 1.8mm;
          }

          .contenido {
            position: relative;
            flex: 1;
            min-height: 0;
            padding: 1.4mm 2mm 32mm;
            text-align: center;
            background: #ffffff;
          }

          .nombre {
            height: 6.3mm;
            margin-bottom: 0.35mm;
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            font-size: 2.55mm;
            line-height: 2.9mm;
            font-weight: 800;
            color: #0f172a;
            word-break: break-word;
          }

          .dato {
            margin: 0;
            font-size: 1.85mm;
            line-height: 2.15mm;
            font-weight: 600;
            color: #334155;
          }

          .qr {
            position: absolute;
            left: 50%;
            bottom: 1mm;
            width: 30mm;
            height: 30mm;
            object-fit: contain;
            transform: translateX(-50%);
            background: #ffffff;
          }

          .footer {
            height: 5mm;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.4mm;
            border-top: 0.2mm solid #e2e8f0;
            background: #f8fafc;
            color: #475569;
            font-size: 1.25mm;
            text-align: center;
          }

          @media print {
            html,
            body {
              background: #ffffff;
            }

            body {
              display: block;
              padding: 0;
            }

            .carnet {
              margin: 0 auto;
              box-shadow: none;
            }
          }
        </style>
      </head>

      <body>
        <article class="carnet">
          <div class="header">
            <img
              id="logo-colegio"
              class="logo"
              src="${logoParaImprimir}"
              alt="Logo institucional"
            />

            <div class="colegio">${nombreColegio}</div>
            <div class="subtitulo">Carnet de Asistencia Escolar</div>
          </div>

          <div class="contenido">
            <div class="nombre">
              ${estudianteQR.nombres} ${estudianteQR.apellidos}
            </div>

            <div class="dato"><strong>DNI:</strong> ${estudianteQR.dni}</div>
            <div class="dato"><strong>Grado:</strong> ${estudianteQR.grado} - ${estudianteQR.seccion}</div>
            <div class="dato"><strong>Turno:</strong> ${estudianteQR.turno?.nombre || "Sin turno"}</div>
            <div class="dato"><strong>Código:</strong> ${estudianteQR.codigo}</div>

            <img
              id="qr-estudiante"
              class="qr"
              src="${qrImagen}"
              alt="Código QR"
            />
          </div>

          <div class="footer">
            Presentar este QR para registrar asistencia
          </div>
        </article>

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

              imagen.onload = resolve;
              imagen.onerror = resolve;
            });
          }

          window.onload = async function() {
            const imagenes = Array.from(
              document.querySelectorAll("img")
            );

            await Promise.all(imagenes.map(esperarImagen));

            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);

  ventana.document.close();
}

  async function imprimirCarnetsSeleccionados() {
    const seleccionados = estudiantes.filter((estudiante) =>
      estudiantesSeleccionados.includes(estudiante.id)
    );

    if (seleccionados.length === 0) {
      setMensaje("❌ Seleccione al menos un estudiante");
      return;
    }

    setMensaje("⏳ Preparando carnets para impresión...");

    try {
      const logoOriginal =
        configuracion.logoUrl?.trim() ||
        `${window.location.origin}/img/logo-santa-rita.png`;

      const logoParaImprimir =
        await convertirImagenADataUrl(logoOriginal);

      const nombreColegio =
        configuracion.nombreColegio?.trim() ||
        "I.E. Santa Rita de Casia";

      const carnets = await Promise.all(
        seleccionados.map(async (estudiante) => ({
          estudiante,
          qr: await QRCode.toDataURL(estudiante.codigo, {
            width: 420,
            margin: 1,
            errorCorrectionLevel: "M",
          }),
        }))
      );

      const ventana = window.open("", "_blank");

      if (!ventana) {
        setMensaje(
          "❌ Permita las ventanas emergentes para imprimir los carnets"
        );
        return;
      }

      const tarjetasHtml = carnets
        .map(
          ({ estudiante, qr }) => `
            <div class="espacio-corte">
              <article class="carnet-lote">
                <div class="header-lote">
                  <img
                    class="logo-lote"
                    src="${logoParaImprimir}"
                    alt="Logo institucional"
                  />

                  <div class="colegio-lote">${nombreColegio}</div>
                  <div class="subtitulo-lote">
                    Carnet de Asistencia Escolar
                  </div>
                </div>

                <div class="contenido-lote">
                  <div class="nombre-lote">
                    ${estudiante.nombres} ${estudiante.apellidos}
                  </div>

                  <div class="dato-lote">
                    <strong>DNI:</strong> ${estudiante.dni}
                  </div>

                  <div class="dato-lote">
                    <strong>Grado:</strong>
                    ${estudiante.grado} - ${estudiante.seccion}
                  </div>

                  <div class="dato-lote">
                    <strong>Turno:</strong>
                    ${estudiante.turno?.nombre || "Sin turno"}
                  </div>

                  <div class="dato-lote">
                    <strong>Código:</strong> ${estudiante.codigo}
                  </div>

                  <img
                    class="qr-lote"
                    src="${qr}"
                    alt="Código QR"
                  />
                </div>

                <div class="footer-lote">
                  Presentar este QR para registrar asistencia
                </div>
              </article>
            </div>
          `
        )
        .join("");

      ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <title>Carnets de estudiantes</title>

            <style>
              @page {
                size: A4 landscape;
                margin: 8mm;
              }

              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background: #ffffff;
              }

              .hoja {
                width: 281mm;
                margin: 0 auto;
                display: grid;
                grid-template-columns: repeat(5, 54mm);
                grid-auto-rows: 86mm;
                column-gap: 2mm;
                row-gap: 4mm;
                justify-content: center;
                align-content: start;
              }

              .espacio-corte {
                width: 54mm;
                height: 86mm;
                display: flex;
                align-items: center;
                justify-content: center;
                break-inside: avoid;
                page-break-inside: avoid;
                outline: 0.2mm dashed #94a3b8;
              }

              .carnet-lote {
                width: 54mm;
                height: 86mm;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                border: 0.35mm solid #1e3a8a;
                border-radius: 4mm;
                background: #ffffff;
              }

              .header-lote {
                height: 22mm;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                background: linear-gradient(
                  180deg,
                  #1e3a8a 0%,
                  #2563eb 100%
                );
              }

              .logo-lote {
                width: 10mm;
                height: 10mm;
                object-fit: contain;
                padding: 0.8mm;
                margin-bottom: 0.7mm;
                border-radius: 2mm;
                background: #ffffff;
              }

              .colegio-lote {
                max-width: 49mm;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                font-size: 2.8mm;
                line-height: 3.1mm;
                font-weight: 800;
                text-transform: uppercase;
              }

              .subtitulo-lote {
                margin-top: 0.2mm;
                font-size: 1.55mm;
                line-height: 1.8mm;
              }

              .contenido-lote {
                position: relative;
                flex: 1;
                min-height: 0;
                padding: 1.4mm 2mm 32mm;
                text-align: center;
                background: #ffffff;
              }

              .nombre-lote {
                height: 6.3mm;
                margin-bottom: 0.35mm;
                overflow: hidden;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                font-size: 2.55mm;
                line-height: 2.9mm;
                font-weight: 800;
                color: #0f172a;
                word-break: break-word;
              }

              .dato-lote {
                margin: 0;
                font-size: 1.85mm;
                line-height: 2.15mm;
                font-weight: 600;
                color: #334155;
              }

              .qr-lote {
                position: absolute;
                left: 50%;
                bottom: 1mm;
                width: 30mm;
                height: 30mm;
                object-fit: contain;
                transform: translateX(-50%);
                background: #ffffff;
              }

              .footer-lote {
                height: 5mm;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0.4mm;
                border-top: 0.2mm solid #e2e8f0;
                background: #f8fafc;
                color: #475569;
                font-size: 1.25mm;
                text-align: center;
              }

              @media screen {
                body {
                  padding: 8mm;
                  background: #e2e8f0;
                }

                .hoja {
                  min-height: 194mm;
                  background: #ffffff;
                  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.18);
                }
              }

              @media print {
                .espacio-corte:nth-child(10n) {
                  break-after: page;
                  page-break-after: always;
                }

                .espacio-corte:last-child {
                  break-after: auto;
                  page-break-after: auto;
                }
              }
            </style>
          </head>

          <body>
            <main class="hoja">${tarjetasHtml}</main>

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

                  imagen.onload = resolve;
                  imagen.onerror = resolve;
                });
              }

              window.onload = async function() {
                const imagenes = Array.from(
                  document.querySelectorAll("img")
                );

                await Promise.all(imagenes.map(esperarImagen));

                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);

      ventana.document.close();

      setMensaje(
        `✅ ${seleccionados.length} carnets preparados para imprimir`
      );
    } catch (error) {
      console.error("Error preparando carnets por lote:", error);
      setMensaje("❌ No se pudieron preparar los carnets");
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={busquedaDni}
              onChange={(e) =>
                setBusquedaDni(
                  e.target.value.replace(/\D/g, "").slice(0, 8)
                )
              }
              placeholder="🔍 Buscar por DNI"
              className="w-full rounded-xl border p-3 sm:w-72"
            />

            <select
              value={turnoFiltro}
              onChange={(e) => setTurnoFiltro(e.target.value)}
              className="rounded-xl border p-3"
            >
              <option value="TODOS">Todos los turnos</option>
              {turnos.map((turno) => (
                <option key={turno.id} value={turno.nombre}>
                  {turno.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={alternarSeleccionTodos}
              disabled={estudiantesFiltrados.length === 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 disabled:opacity-50"
            >
              {todosFiltradosSeleccionados
                ? "☐ Quitar selección"
                : "☑ Seleccionar visibles"}
            </button>

            <button
              type="button"
              onClick={imprimirCarnetsSeleccionados}
              disabled={estudiantesSeleccionados.length === 0}
              className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              🖨 Imprimir carnets ({estudiantesSeleccionados.length})
            </button>
          </div>
        </div>

        {mensaje && <p className="mb-4 mt-4 font-bold">{mensaje}</p>}

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left min-w-[1080px]">
            <thead>
              <tr className="border-b">
                <th className="w-12 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={todosFiltradosSeleccionados}
                    onChange={alternarSeleccionTodos}
                    aria-label="Seleccionar estudiantes visibles"
                    className="h-4 w-4"
                  />
                </th>
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
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      checked={estudiantesSeleccionados.includes(estudiante.id)}
                      onChange={() => alternarSeleccionEstudiante(estudiante.id)}
                      aria-label={`Seleccionar a ${estudiante.nombres} ${estudiante.apellidos}`}
                      className="h-4 w-4"
                    />
                  </td>
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
                  <td colSpan={12} className="py-6 text-center text-slate-500">
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