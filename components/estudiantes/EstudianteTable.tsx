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

/**
 * Configuración de Ultra Alta Definición para Códigos QR de Carnets Escolares.
 * - Resolución: 1200 x 1200 px nativos en formato PNG sin pérdida (lossless).
 * - Nivel de corrección: "H" (High - 30% de tolerancia ante rayones, desgaste o reflejos por plastificado).
 * - Margen reglamentario: 4 módulos de zona blanca ("quiet zone") garantizada.
 * - Contraste óptico: Módulos negro puro (#000000) sobre fondo blanco (#ffffff).
 */
const CONFIG_QR_HD = {
  width: 1200,
  margin: 4,
  errorCorrectionLevel: "H" as const,
  color: {
    dark: "#000000",
    light: "#ffffff",
  },
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

  function registrarRostro(estudiante: Estudiante) {
    window.location.href =
      `/dashboard/estudiantes/${estudiante.id}/rostro`;
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
    const qr = await QRCode.toDataURL(estudiante.codigo, CONFIG_QR_HD);
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
  function generarHtmlCarnet(
    estudiante: Estudiante,
    qrUrl: string,
    logoParaImprimir: string,
    nombreColegio: string
  ): string {
    return `
      <div class="espacio-corte">
        <div class="guia-corte corte-tl"></div>
        <div class="guia-corte corte-tr"></div>
        <div class="guia-corte corte-bl"></div>
        <div class="guia-corte corte-br"></div>

        <article class="carnet">
          <div class="zona-perforacion">
            <div class="ranura-collar" title="Zona de perforación para collar">
              <span class="punto-guia"></span>
            </div>
            <span class="label-perforacion">ZONA DE PERFORACIÓN</span>
          </div>

          <div class="header">
            <img
              class="logo"
              src="${logoParaImprimir}"
              alt="Logo institucional"
            />
            <div class="colegio">${nombreColegio}</div>
            <div class="subtitulo">CARNET DE ASISTENCIA ESCOLAR</div>
          </div>

          <div class="contenido">
            <div class="nombre">
              ${estudiante.nombres} ${estudiante.apellidos}
            </div>

            <div class="datos-grid">
              <div class="dato-item">
                <span class="dato-label">DNI:</span>
                <span class="dato-valor">${estudiante.dni}</span>
              </div>
              <div class="dato-item">
                <span class="dato-label">GRADO:</span>
                <span class="dato-valor">${estudiante.grado}</span>
              </div>
              <div class="dato-item">
                <span class="dato-label">SECCIÓN:</span>
                <span class="dato-valor">${estudiante.seccion}</span>
              </div>
              <div class="dato-item">
                <span class="dato-label">TURNO:</span>
                <span class="dato-valor">${estudiante.turno?.nombre || "Sin turno"}</span>
              </div>
              <div class="dato-item">
                <span class="dato-label">CÓDIGO:</span>
                <span class="dato-valor">${estudiante.codigo}</span>
              </div>
            </div>

            <div class="qr-box">
              <img
                class="qr"
                src="${qrUrl}"
                alt="Código QR Asistencia"
              />
            </div>
          </div>

          <div class="footer">
            Presentar este QR para registrar asistencia
          </div>
        </article>
      </div>
    `;
  }

  function obtenerEstilosImpresion(): string {
    return `
      @page {
        size: A4 portrait;
        margin: 0mm;
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
        font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #ffffff;
      }

      .hoja-a4 {
        width: 210mm;
        height: 297mm;
        max-width: 210mm;
        max-height: 297mm;
        box-sizing: border-box;
        padding: 24mm 10mm;
        display: grid;
        grid-template-columns: repeat(3, 50mm);
        grid-template-rows: repeat(2, 100mm);
        column-gap: 20mm;
        row-gap: 24mm;
        justify-content: center;
        align-content: center;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
        overflow: hidden;
        background: #ffffff;
      }

      .hoja-a4:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .hoja-a4-individual {
        width: 210mm;
        height: 297mm;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: auto;
        break-after: auto;
        overflow: hidden;
        background: #ffffff;
      }

      .espacio-corte {
        position: relative;
        width: 50mm;
        height: 100mm;
        box-sizing: border-box;
      }

      .guia-corte {
        position: absolute;
        pointer-events: none;
        z-index: 10;
      }

      .corte-tl {
        top: -3.5mm;
        left: -3.5mm;
        width: 4.5mm;
        height: 4.5mm;
        border-top: 0.35mm solid #64748b;
        border-left: 0.35mm solid #64748b;
      }

      .corte-tr {
        top: -3.5mm;
        right: -3.5mm;
        width: 4.5mm;
        height: 4.5mm;
        border-top: 0.35mm solid #64748b;
        border-right: 0.35mm solid #64748b;
      }

      .corte-bl {
        bottom: -3.5mm;
        left: -3.5mm;
        width: 4.5mm;
        height: 4.5mm;
        border-bottom: 0.35mm solid #64748b;
        border-left: 0.35mm solid #64748b;
      }

      .corte-br {
        bottom: -3.5mm;
        right: -3.5mm;
        width: 4.5mm;
        height: 4.5mm;
        border-bottom: 0.35mm solid #64748b;
        border-right: 0.35mm solid #64748b;
      }

      .carnet {
        width: 50mm;
        height: 100mm;
        box-sizing: border-box;
        border: 0.35mm dashed #64748b;
        border-radius: 4mm;
        background: #ffffff;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .zona-perforacion {
        height: 8.5mm;
        flex-shrink: 0;
        background: #f8fafc;
        border-bottom: 0.25mm dashed #cbd5e1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.4mm 1mm;
      }

      .ranura-collar {
        width: 12mm;
        height: 3mm;
        border: 0.35mm dashed #64748b;
        border-radius: 1.5mm;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .punto-guia {
        width: 1mm;
        height: 1mm;
        border-radius: 50%;
        background: #94a3b8;
      }

      .label-perforacion {
        font-size: 1.25mm;
        line-height: 1.4mm;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.2px;
        margin-top: 0.3mm;
      }

      .header {
        height: 21mm;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, #1e3a8a 0%, #2563eb 100%);
        color: #ffffff;
        padding: 0.8mm 1.5mm;
      }

      .logo {
        width: 9.5mm;
        height: 9.5mm;
        object-fit: contain;
        padding: 0.5mm;
        border-radius: 1.8mm;
        background: #ffffff;
        margin-bottom: 0.4mm;
      }

      .colegio {
        max-width: 47mm;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 2.5mm;
        line-height: 2.8mm;
        font-weight: 800;
        text-transform: uppercase;
        color: #ffffff;
        text-align: center;
      }

      .subtitulo {
        font-size: 1.45mm;
        line-height: 1.7mm;
        font-weight: 600;
        color: #dbeafe;
        letter-spacing: 0.2px;
        margin-top: 0.2mm;
      }

      .contenido {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.6mm 2.5mm 0.8mm;
        background: #ffffff;
      }

      .nombre {
        font-size: 2.35mm;
        line-height: 2.7mm;
        font-weight: 800;
        color: #0f172a;
        text-transform: uppercase;
        text-align: center;
        max-height: 5.4mm;
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        margin-bottom: 0.4mm;
        word-break: break-word;
      }

      /* BLOQUE DE INFORMACIÓN COMPACTO - FICHA TÉCNICA */
      .datos-grid {
        width: 100%;
        max-width: 35mm;
        display: flex;
        flex-direction: column;
        gap: 0.2mm;
        margin: 0 auto;
        margin-bottom: 1.6mm;
      }

      .dato-item {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        justify-content: flex-start;
        font-size: 1.6mm;
        line-height: 1.95mm;
      }

      .dato-label {
        font-weight: 700;
        color: #475569;
        width: 11.5mm;
        flex-shrink: 0;
        letter-spacing: 0.1px;
      }

      .dato-valor {
        font-weight: 700;
        color: #0f172a;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .qr-box {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        padding: 0.8mm;
        border: 0.25mm solid #cbd5e1;
        border-radius: 1.8mm;
      }

      .qr {
        width: 36mm;
        height: 36mm;
        min-width: 36mm;
        min-height: 36mm;
        object-fit: contain;
        display: block;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }

      .footer {
        height: 4.5mm;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        border-top: 0.2mm solid #e2e8f0;
        font-size: 1.25mm;
        font-weight: 600;
        color: #475569;
        text-align: center;
      }

      @media screen {
        body {
          padding: 12mm;
          background: #475569;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10mm;
        }

        .hoja-a4,
        .hoja-a4-individual {
          background: #ffffff;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
          border-radius: 2mm;
        }
      }
    `;
  }

  async function imprimirQR() {
    if (!estudianteQR) return;

    const logoOriginal =
      configuracion.logoUrl?.trim() ||
      `${window.location.origin}/img/logo-santa-rita.png`;

    const logoParaImprimir =
      await convertirImagenADataUrl(logoOriginal);

    const nombreColegio =
      configuracion.nombreColegio?.trim() ||
      "I.E. Santa Rita de Casia";

    const qrParaImprimir =
      await QRCode.toDataURL(estudianteQR.codigo, CONFIG_QR_HD);

    const ventana = window.open("", "_blank");

    if (!ventana) {
      setMensaje(
        "❌ Permita las ventanas emergentes para imprimir el carnet"
      );
      return;
    }

    const carnetHtml = generarHtmlCarnet(
      estudianteQR,
      qrParaImprimir,
      logoParaImprimir,
      nombreColegio
    );

    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Carnet QR - ${estudianteQR.nombres} ${estudianteQR.apellidos}</title>
          <style>${obtenerEstilosImpresion()}</style>
        </head>
        <body>
          <main class="hoja-a4-individual">
            ${carnetHtml}
          </main>

          <script>
            function esperarImagen(imagen) {
              return new Promise(function(resolve) {
                if (!imagen) { resolve(); return; }
                if (imagen.complete && imagen.naturalWidth > 0) { resolve(); return; }
                imagen.onload = resolve;
                imagen.onerror = resolve;
              });
            }

            window.onload = async function() {
              const imagenes = Array.from(document.querySelectorAll("img"));
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
          qr: await QRCode.toDataURL(estudiante.codigo, CONFIG_QR_HD),
        }))
      );

      const ventana = window.open("", "_blank");

      if (!ventana) {
        setMensaje(
          "❌ Permita las ventanas emergentes para imprimir los carnets"
        );
        return;
      }

      // Dividir en páginas fijas de exactamente 6 carnets (3 columnas x 2 filas)
      const CARNETS_POR_HOJA = 6;
      const paginas: typeof carnets[] = [];
      for (let i = 0; i < carnets.length; i += CARNETS_POR_HOJA) {
        paginas.push(carnets.slice(i, i + CARNETS_POR_HOJA));
      }

      const paginasHtml = paginas
        .map((grupoCarnets) => {
          const tarjetasHtml = grupoCarnets
            .map(({ estudiante, qr }) =>
              generarHtmlCarnet(estudiante, qr, logoParaImprimir, nombreColegio)
            )
            .join("");

          return `<main class="hoja-a4">${tarjetasHtml}</main>`;
        })
        .join("");

      ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <title>Carnets de estudiantes (${seleccionados.length})</title>
            <style>${obtenerEstilosImpresion()}</style>
          </head>
          <body>
            ${paginasHtml}

            <script>
              function esperarImagen(imagen) {
                return new Promise(function(resolve) {
                  if (!imagen) { resolve(); return; }
                  if (imagen.complete && imagen.naturalWidth > 0) { resolve(); return; }
                  imagen.onload = resolve;
                  imagen.onerror = resolve;
                });
              }

              window.onload = async function() {
                const imagenes = Array.from(document.querySelectorAll("img"));
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
        `✅ ${seleccionados.length} carnets preparados para imprimir (${paginas.length} ${paginas.length === 1 ? "hoja" : "hojas"})`
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
                      onClick={() => registrarRostro(estudiante)}
                      className="bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold"
                    >
                      📷 Rostro
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
                className="mx-auto mt-6 w-64 h-64 object-contain rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
              />
            )}

            <button
              onClick={() => imprimirQR()}
              className="mt-6 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition"
            >
              🖨 Imprimir Carnet Escolar
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