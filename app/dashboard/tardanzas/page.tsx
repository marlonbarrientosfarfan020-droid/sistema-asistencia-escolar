"use client";

import { useEffect, useState } from "react";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";

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

function escaparHtml(valor: string | number | null | undefined) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function TardanzasPage() {
  const { configuracion } = useConfiguracionColegio();

  const [fecha, setFecha] = useState(fechaHoyPeru());
  const [dni, setDni] = useState("");
  const [tardanzas, setTardanzas] = useState<Tardanza[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

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
          credentials: "include",
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok) {
        setTardanzas([]);
        setMensaje(
          `❌ ${
            data.message ||
            "No se pudieron cargar las tardanzas"
          }`
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
      setTardanzas([]);
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

  function fechaFormateada() {
    const fechaPeru = new Date(`${fecha}T12:00:00-05:00`);

    return fechaPeru.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Lima",
    });
  }

  function nombreArchivo(extension: string) {
    const filtroDni = dni.trim()
      ? `-dni-${dni.trim()}`
      : "";

    return `reporte-tardanzas-${fecha}${filtroDni}.${extension}`;
  }

  function exportarExcel() {
    if (tardanzas.length === 0) {
      setMensaje(
        "❌ No hay tardanzas para exportar"
      );
      return;
    }

    setExportando(true);

    try {
      const filas = [
        [
          configuracion.nombreColegio ||
            "Santa Rita de Casia",
        ],
        ["REPORTE DE TARDANZAS"],
        ["Fecha", fechaFormateada()],
        [
          "Filtro DNI",
          dni.trim() || "Todos los estudiantes",
        ],
        ["Total", String(tardanzas.length)],
        [],
        [
          "Estudiante",
          "DNI",
          "Grado",
          "Sección",
          "Turno",
          "Hora de entrada",
          "Minutos de tardanza",
          "Método",
        ],
        ...tardanzas.map((item) => [
          `${item.estudiante.nombres} ${item.estudiante.apellidos}`,
          item.estudiante.dni,
          item.estudiante.grado,
          item.estudiante.seccion,
          item.estudiante.turno,
          hora(item.horaEntrada),
          String(item.minutosTardanza),
          item.metodo,
        ]),
      ];

      const contenidoCsv = filas
        .map((fila) =>
          fila
            .map((celda) => {
              const valor = String(celda ?? "").replaceAll(
                '"',
                '""'
              );

              return `"${valor}"`;
            })
            .join(";")
        )
        .join("\r\n");

      const blob = new Blob(
        ["\uFEFF", contenidoCsv],
        {
          type: "text/csv;charset=utf-8;",
        }
      );

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = nombreArchivo("csv");

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      URL.revokeObjectURL(url);

      setMensaje(
        "✅ Reporte para Excel descargado correctamente"
      );
    } catch (error) {
      console.error(
        "Error exportando reporte para Excel:",
        error
      );

      setMensaje(
        "❌ No se pudo exportar el reporte para Excel"
      );
    } finally {
      setExportando(false);
    }
  }

  async function convertirImagenADataUrl(
    url: string
  ): Promise<string> {
    if (!url) return "";

    try {
      const respuesta = await fetch(url, {
        cache: "no-store",
      });

      if (!respuesta.ok) return "";

      const blob = await respuesta.blob();

      return await new Promise<string>(
        (resolve, reject) => {
          const lector = new FileReader();

          lector.onloadend = () => {
            if (typeof lector.result === "string") {
              resolve(lector.result);
            } else {
              resolve("");
            }
          };

          lector.onerror = () => {
            reject(
              new Error(
                "No se pudo preparar el logo"
              )
            );
          };

          lector.readAsDataURL(blob);
        }
      );
    } catch (error) {
      console.error(
        "Error preparando logo para PDF:",
        error
      );

      return "";
    }
  }

  async function exportarPDF() {
    if (tardanzas.length === 0) {
      setMensaje(
        "❌ No hay tardanzas para exportar"
      );
      return;
    }

    const ventana = window.open("", "_blank");

    if (!ventana) {
      setMensaje(
        "❌ Permita las ventanas emergentes para generar el PDF"
      );
      return;
    }

    setExportando(true);
    setMensaje("⏳ Preparando reporte PDF...");

    try {
      const logoUrl =
        await convertirImagenADataUrl(
          configuracion.logoUrl || ""
        );

      const nombreColegio =
        configuracion.nombreColegio ||
        "Santa Rita de Casia";

      const filas = tardanzas
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                ${escaparHtml(
                  `${item.estudiante.nombres} ${item.estudiante.apellidos}`
                )}
              </td>
              <td>${escaparHtml(
                item.estudiante.dni
              )}</td>
              <td>
                ${escaparHtml(
                  item.estudiante.grado
                )} -
                ${escaparHtml(
                  item.estudiante.seccion
                )}
              </td>
              <td>${escaparHtml(
                item.estudiante.turno
              )}</td>
              <td>${escaparHtml(
                hora(item.horaEntrada)
              )}</td>
              <td class="demora">
                ${escaparHtml(
                  item.minutosTardanza
                )} min
              </td>
              <td>${escaparHtml(
                item.metodo
              )}</td>
            </tr>
          `
        )
        .join("");

      ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />

            <title>
              Reporte de tardanzas
            </title>

            <style>
              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                padding: 30px;
                font-family: Arial, sans-serif;
                color: #0f172a;
                background: white;
              }

              .encabezado {
                display: flex;
                align-items: center;
                gap: 18px;
                border-bottom: 4px solid #ea580c;
                padding-bottom: 18px;
                margin-bottom: 24px;
              }

              .logo {
                width: 80px;
                height: 80px;
                object-fit: contain;
              }

              .titulo-colegio {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
              }

              .titulo-reporte {
                margin: 6px 0 0;
                color: #ea580c;
                font-size: 20px;
              }

              .informacion {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 24px;
              }

              .dato {
                border: 1px solid #cbd5e1;
                border-radius: 10px;
                padding: 12px;
                background: #f8fafc;
              }

              .dato strong {
                display: block;
                margin-bottom: 5px;
                color: #475569;
                font-size: 12px;
                text-transform: uppercase;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
              }

              th {
                background: #0f172a;
                color: white;
                padding: 10px 8px;
                text-align: left;
              }

              td {
                border: 1px solid #cbd5e1;
                padding: 9px 8px;
              }

              tbody tr:nth-child(even) {
                background: #f8fafc;
              }

              .demora {
                color: #c2410c;
                font-weight: 800;
              }

              .pie {
                margin-top: 25px;
                text-align: right;
                font-size: 11px;
                color: #64748b;
              }

              @page {
                size: A4 landscape;
                margin: 12mm;
              }

              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>

          <body>
            <div class="encabezado">
              ${
                logoUrl
                  ? `
                    <img
                      class="logo"
                      src="${logoUrl}"
                      alt="Logo institucional"
                    />
                  `
                  : ""
              }

              <div>
                <h1 class="titulo-colegio">
                  ${escaparHtml(nombreColegio)}
                </h1>

                <h2 class="titulo-reporte">
                  Reporte de tardanzas
                </h2>
              </div>
            </div>

            <div class="informacion">
              <div class="dato">
                <strong>Fecha consultada</strong>
                ${escaparHtml(fechaFormateada())}
              </div>

              <div class="dato">
                <strong>Filtro por DNI</strong>
                ${escaparHtml(
                  dni.trim() ||
                    "Todos los estudiantes"
                )}
              </div>

              <div class="dato">
                <strong>Total de tardanzas</strong>
                ${tardanzas.length}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Estudiante</th>
                  <th>DNI</th>
                  <th>Grado</th>
                  <th>Turno</th>
                  <th>Entrada</th>
                  <th>Demora</th>
                  <th>Método</th>
                </tr>
              </thead>

              <tbody>
                ${filas}
              </tbody>
            </table>

            <div class="pie">
              Generado el
              ${escaparHtml(
                new Date().toLocaleString("es-PE", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Lima",
                })
              )}
            </div>

            <script>
              function esperarImagenes() {
                const imagenes =
                  Array.from(
                    document.querySelectorAll("img")
                  );

                return Promise.all(
                  imagenes.map(function(imagen) {
                    return new Promise(function(resolve) {
                      if (
                        imagen.complete &&
                        imagen.naturalWidth > 0
                      ) {
                        resolve();
                        return;
                      }

                      imagen.onload = resolve;
                      imagen.onerror = resolve;
                    });
                  })
                );
              }

              window.onload = async function() {
                await esperarImagenes();

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

      setMensaje(
        "✅ Reporte preparado. Seleccione “Guardar como PDF” en la ventana de impresión."
      );
    } catch (error) {
      console.error(
        "Error generando reporte PDF:",
        error
      );

      ventana.close();

      setMensaje(
        "❌ No se pudo generar el reporte PDF"
      );
    } finally {
      setExportando(false);
    }
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
              onChange={(e) =>
                setFecha(e.target.value)
              }
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-600">
              Buscar por DNI
            </label>

            <input
              value={dni}
              onChange={(e) =>
                setDni(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 8)
                )
              }
              placeholder="Ingrese DNI"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={cargarTardanzas}
              disabled={cargando}
              className="w-full rounded-xl bg-orange-600 px-5 py-3 font-black text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              {cargando
                ? "Buscando..."
                : "Buscar tardanzas"}
            </button>
          </div>
        </div>
      </section>

      {mensaje && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 font-bold shadow-sm">
          {mensaje}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Detalle de tardanzas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total encontrado: {tardanzas.length}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={exportarExcel}
              disabled={
                tardanzas.length === 0 ||
                exportando
              }
              className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📊 Exportar Excel
            </button>

            <button
              type="button"
              onClick={exportarPDF}
              disabled={
                tardanzas.length === 0 ||
                exportando
              }
              className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[950px] text-left">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-4 py-4">
                  Estudiante
                </th>
                <th className="px-4 py-4">
                  DNI
                </th>
                <th className="px-4 py-4">
                  Grado
                </th>
                <th className="px-4 py-4">
                  Turno
                </th>
                <th className="px-4 py-4">
                  Entrada
                </th>
                <th className="px-4 py-4">
                  Demora
                </th>
                <th className="px-4 py-4">
                  Método
                </th>
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

              {!cargando &&
                tardanzas.length === 0 && (
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