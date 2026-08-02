"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfiguracionColegio } from "@/hooks/useConfiguracionColegio";

type Turno = {
  id: number;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
};

type Ausente = {
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

  turno: {
    id: number;
    nombre: string;
    horaEntrada: string;
    horaSalida: string;
  } | null;

  estado: string;
  motivo: string;
  alertaEnviada: boolean;
  fechaAlerta: string | null;
};

type RespuestaAusentes = {
  ok: boolean;
  fecha: string;
  total: number;
  alertasEnviadas: number;
  alertasPendientes: number;
  diaNoLectivo: boolean;
  diaNoLectivoGeneral: boolean;
  turnos: Turno[];
  ausentes: Ausente[];
  message?: string;
};

function fechaHoyPeru() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escaparHtml(
  valor: string | number | null | undefined
) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function AusentesPage() {
  const { configuracion } =
    useConfiguracionColegio();

  const [fecha, setFecha] =
    useState(fechaHoyPeru());

  const [dni, setDni] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [grado, setGrado] = useState("");
  const [seccion, setSeccion] = useState("");

  const [ausentes, setAusentes] = useState<
    Ausente[]
  >([]);

  const [turnos, setTurnos] = useState<Turno[]>(
    []
  );

  const [alertasEnviadas, setAlertasEnviadas] =
    useState(0);

  const [alertasPendientes, setAlertasPendientes] =
    useState(0);

  const [diaNoLectivo, setDiaNoLectivo] =
    useState(false);

  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] =
    useState(false);

  const gradosDisponibles = useMemo(() => {
    const valores = new Set(
      ausentes
        .map((item) => item.grado)
        .filter(Boolean)
    );

    return Array.from(valores).sort((a, b) =>
      a.localeCompare(b, "es", {
        numeric: true,
      })
    );
  }, [ausentes]);

  const seccionesDisponibles = useMemo(() => {
    const valores = new Set(
      ausentes
        .map((item) => item.seccion)
        .filter(Boolean)
    );

    return Array.from(valores).sort();
  }, [ausentes]);

  async function cargarAusentes() {
    setCargando(true);
    setMensaje("");

    try {
      const params = new URLSearchParams({
        fecha,
      });

      if (dni.trim()) {
        params.set("dni", dni.trim());
      }

      if (turnoId) {
        params.set("turnoId", turnoId);
      }

      if (grado) {
        params.set("grado", grado);
      }

      if (seccion) {
        params.set("seccion", seccion);
      }

      const respuesta = await fetch(
        `/api/ausentes?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data =
        (await respuesta.json()) as RespuestaAusentes;

      if (!respuesta.ok || !data.ok) {
        setAusentes([]);
        setMensaje(
          `❌ ${
            data.message ||
            "No se pudieron cargar los ausentes"
          }`
        );

        return;
      }

      setAusentes(
        Array.isArray(data.ausentes)
          ? data.ausentes
          : []
      );

      setTurnos(
        Array.isArray(data.turnos)
          ? data.turnos
          : []
      );

      setAlertasEnviadas(
        data.alertasEnviadas || 0
      );

      setAlertasPendientes(
        data.alertasPendientes || 0
      );

      setDiaNoLectivo(
        Boolean(data.diaNoLectivo)
      );
    } catch (error) {
      console.error(
        "Error cargando ausentes:",
        error
      );

      setAusentes([]);
      setMensaje(
        "❌ Error al conectar con el servidor"
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarAusentes();
  }, [fecha]);

  function limpiarFiltros() {
    setDni("");
    setTurnoId("");
    setGrado("");
    setSeccion("");

    setTimeout(() => {
      void cargarAusentes();
    }, 50);
  }

  function fechaFormateada() {
    const fechaSeleccionada = new Date(
      `${fecha}T12:00:00-05:00`
    );

    return fechaSeleccionada.toLocaleDateString(
      "es-PE",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Lima",
      }
    );
  }

  function fechaHora(
    valor: string | null
  ) {
    if (!valor) {
      return "Pendiente";
    }

    return new Date(valor).toLocaleString(
      "es-PE",
      {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Lima",
      }
    );
  }

  function nombreArchivo(extension: string) {
    return `reporte-ausentes-${fecha}.${extension}`;
  }

  function exportarExcel() {
    if (ausentes.length === 0) {
      setMensaje(
        "❌ No existen ausentes para exportar"
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
        ["REPORTE DE ESTUDIANTES AUSENTES"],
        ["Fecha", fechaFormateada()],
        ["Total de ausentes", ausentes.length],
        ["Alertas enviadas", alertasEnviadas],
        ["Alertas pendientes", alertasPendientes],
        [],
        [
          "Código",
          "DNI",
          "Estudiante",
          "Grado",
          "Sección",
          "Turno",
          "Tutor",
          "Celular",
          "Telegram Chat ID",
          "Estado de alerta",
          "Fecha de alerta",
          "Motivo",
        ],

        ...ausentes.map((item) => [
          item.codigo,
          item.dni,
          `${item.nombres} ${item.apellidos}`,
          item.grado,
          item.seccion,
          item.turno?.nombre || "Sin turno",
          item.nombreTutor,
          item.whatsapp,
          item.telegramChatId,
          item.alertaEnviada
            ? "ALERTA ENVIADA"
            : "ALERTA PENDIENTE",
          fechaHora(item.fechaAlerta),
          item.motivo,
        ]),
      ];

      const contenidoCsv = filas
        .map((fila) =>
          fila
            .map((celda) => {
              const valor = String(
                celda ?? ""
              ).replaceAll('"', '""');

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
      const enlace =
        document.createElement("a");

      enlace.href = url;
      enlace.download =
        nombreArchivo("csv");

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      URL.revokeObjectURL(url);

      setMensaje(
        "✅ Reporte para Excel descargado correctamente"
      );
    } catch (error) {
      console.error(
        "Error exportando ausentes:",
        error
      );

      setMensaje(
        "❌ No se pudo exportar el reporte"
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
        (resolve) => {
          const lector = new FileReader();

          lector.onloadend = () => {
            resolve(
              typeof lector.result === "string"
                ? lector.result
                : ""
            );
          };

          lector.onerror = () => resolve("");

          lector.readAsDataURL(blob);
        }
      );
    } catch {
      return "";
    }
  }

  async function exportarPDF() {
    if (ausentes.length === 0) {
      setMensaje(
        "❌ No existen ausentes para exportar"
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

      const filas = ausentes
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>

              <td>
                ${escaparHtml(
                  `${item.nombres} ${item.apellidos}`
                )}
              </td>

              <td>
                ${escaparHtml(item.dni)}
              </td>

              <td>
                ${escaparHtml(item.grado)} -
                ${escaparHtml(item.seccion)}
              </td>

              <td>
                ${escaparHtml(
                  item.turno?.nombre || "Sin turno"
                )}
              </td>

              <td>
                ${escaparHtml(
                  item.nombreTutor || "-"
                )}
              </td>

              <td>
                ${escaparHtml(
                  item.whatsapp || "-"
                )}
              </td>

              <td>
                <span class="${
                  item.alertaEnviada
                    ? "enviada"
                    : "pendiente"
                }">
                  ${
                    item.alertaEnviada
                      ? "ENVIADA"
                      : "PENDIENTE"
                  }
                </span>
              </td>
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
              Reporte de ausentes
            </title>

            <style>
              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                padding: 28px;
                font-family: Arial, sans-serif;
                color: #0f172a;
                background: white;
              }

              .encabezado {
                display: flex;
                align-items: center;
                gap: 18px;
                border-bottom: 4px solid #dc2626;
                padding-bottom: 18px;
                margin-bottom: 22px;
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
                color: #dc2626;
                font-size: 20px;
              }

              .informacion {
                display: grid;
                grid-template-columns:
                  repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 22px;
              }

              .dato {
                border: 1px solid #cbd5e1;
                border-radius: 10px;
                padding: 11px;
                background: #f8fafc;
              }

              .dato strong {
                display: block;
                margin-bottom: 5px;
                color: #475569;
                font-size: 11px;
                text-transform: uppercase;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
              }

              th {
                background: #0f172a;
                color: white;
                padding: 9px 7px;
                text-align: left;
              }

              td {
                border: 1px solid #cbd5e1;
                padding: 8px 7px;
              }

              tbody tr:nth-child(even) {
                background: #f8fafc;
              }

              .enviada {
                color: #047857;
                font-weight: 800;
              }

              .pendiente {
                color: #b45309;
                font-weight: 800;
              }

              .pie {
                margin-top: 22px;
                text-align: right;
                font-size: 10px;
                color: #64748b;
              }

              @page {
                size: A4 landscape;
                margin: 10mm;
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
                  Reporte de estudiantes ausentes
                </h2>
              </div>
            </div>

            <div class="informacion">
              <div class="dato">
                <strong>Fecha</strong>
                ${escaparHtml(fechaFormateada())}
              </div>

              <div class="dato">
                <strong>Total ausentes</strong>
                ${ausentes.length}
              </div>

              <div class="dato">
                <strong>Alertas enviadas</strong>
                ${alertasEnviadas}
              </div>

              <div class="dato">
                <strong>Alertas pendientes</strong>
                ${alertasPendientes}
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
                  <th>Tutor</th>
                  <th>Celular</th>
                  <th>Alerta</th>
                </tr>
              </thead>

              <tbody>
                ${filas}
              </tbody>
            </table>

            <div class="pie">
              Generado el
              ${escaparHtml(
                new Date().toLocaleString(
                  "es-PE",
                  {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone:
                      "America/Lima",
                  }
                )
              )}
            </div>

            <script>
              function esperarImagenes() {
                const imagenes = Array.from(
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
        "✅ Reporte preparado. Seleccione Guardar como PDF."
      );
    } catch (error) {
      console.error(
        "Error generando PDF:",
        error
      );

      ventana.close();

      setMensaje(
        "❌ No se pudo generar el PDF"
      );
    } finally {
      setExportando(false);
    }
  }

  return (
    <main className="min-h-screen space-y-6 bg-slate-100 p-4 md:p-7">
      {/* CABECERA */}
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-red-700 via-rose-600 to-orange-600 p-7 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

        <div className="relative">
          <h1 className="text-3xl font-black md:text-4xl">
            ❌ Estudiantes ausentes
          </h1>

          <p className="mt-2 text-red-100">
            Estudiantes que no registraron ingreso
            durante toda la jornada escolar
          </p>
        </div>
      </section>

      {/* INDICADORES */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Ausentes confirmados"
          valor={ausentes.length}
          icono="❌"
          clase="border-red-200 bg-red-50 text-red-700"
        />

        <Indicador
          titulo="Alertas enviadas"
          valor={alertasEnviadas}
          icono="📨"
          clase="border-emerald-200 bg-emerald-50 text-emerald-700"
        />

        <Indicador
          titulo="Alertas pendientes"
          valor={alertasPendientes}
          icono="⚠️"
          clase="border-amber-200 bg-amber-50 text-amber-700"
        />

        <Indicador
          titulo="Fecha consultada"
          valor={fechaFormateada()}
          icono="📅"
          clase="border-blue-200 bg-blue-50 text-blue-700"
        />
      </section>

      {/* DÍA NO LECTIVO */}
      {diaNoLectivo && (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-800 shadow-sm">
          📅 La fecha seleccionada tiene uno o más
          eventos no lectivos. Los turnos suspendidos
          no se consideran ausentes.
        </section>
      )}

      {/* FILTROS */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">
          🔍 Filtros de búsqueda
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <CampoFiltro titulo="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) =>
                setFecha(e.target.value)
              }
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-red-500"
            />
          </CampoFiltro>

          <CampoFiltro titulo="DNI">
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
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-red-500"
            />
          </CampoFiltro>

          <CampoFiltro titulo="Turno">
            <select
              value={turnoId}
              onChange={(e) =>
                setTurnoId(e.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">
                Todos los turnos
              </option>

              {turnos.map((turno) => (
                <option
                  key={turno.id}
                  value={turno.id}
                >
                  {turno.nombre}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Grado">
            <input
              value={grado}
              onChange={(e) =>
                setGrado(e.target.value)
              }
              placeholder="Ejemplo: 4"
              list="lista-grados"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-red-500"
            />

            <datalist id="lista-grados">
              {gradosDisponibles.map((item) => (
                <option
                  key={item}
                  value={item}
                />
              ))}
            </datalist>
          </CampoFiltro>

          <CampoFiltro titulo="Sección">
            <input
              value={seccion}
              onChange={(e) =>
                setSeccion(
                  e.target.value
                    .toUpperCase()
                    .slice(0, 2)
                )
              }
              placeholder="Ejemplo: A"
              list="lista-secciones"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-red-500"
            />

            <datalist id="lista-secciones">
              {seccionesDisponibles.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  />
                )
              )}
            </datalist>
          </CampoFiltro>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => void cargarAusentes()}
            disabled={cargando}
            className="rounded-xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {cargando
              ? "Buscando..."
              : "🔍 Buscar ausentes"}
          </button>

          <button
            onClick={limpiarFiltros}
            disabled={cargando}
            className="rounded-xl bg-slate-200 px-6 py-3 font-black text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {mensaje && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 font-bold shadow-sm">
          {mensaje}
        </section>
      )}

      {/* TABLA */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Detalle de ausencias
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total encontrado: {ausentes.length}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={exportarExcel}
              disabled={
                ausentes.length === 0 ||
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
                ausentes.length === 0 ||
                exportando
              }
              className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[1450px] text-left">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-4">
                  Estudiante
                </th>

                <th className="px-4 py-4">
                  DNI
                </th>

                <th className="px-4 py-4">
                  Código
                </th>

                <th className="px-4 py-4">
                  Grado
                </th>

                <th className="px-4 py-4">
                  Turno
                </th>

                <th className="px-4 py-4">
                  Tutor
                </th>

                <th className="px-4 py-4">
                  Celular
                </th>

                <th className="px-4 py-4">
                  Telegram
                </th>

                <th className="px-4 py-4">
                  Estado
                </th>

                <th className="px-4 py-4">
                  Alerta
                </th>

                <th className="px-4 py-4">
                  Fecha de alerta
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {ausentes.map(
                (item, index) => (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-red-50 ${
                      index % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">
                        {item.nombres}{" "}
                        {item.apellidos}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.motivo}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      {item.dni}
                    </td>

                    <td className="px-4 py-4">
                      {item.codigo}
                    </td>

                    <td className="px-4 py-4">
                      {item.grado} -{" "}
                      {item.seccion}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold">
                        {item.turno?.nombre ||
                          "Sin turno"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.turno
                          ? `${item.turno.horaEntrada} - ${item.turno.horaSalida}`
                          : "-"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {item.nombreTutor || "-"}
                    </td>

                    <td className="px-4 py-4">
                      {item.whatsapp || "-"}
                    </td>

                    <td className="px-4 py-4">
                      {item.telegramChatId || "-"}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                        AUSENTE
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {item.alertaEnviada ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                          📨 ENVIADA
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
                          ⚠️ PENDIENTE
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm">
                      {fechaHora(
                        item.fechaAlerta
                      )}
                    </td>
                  </tr>
                )
              )}

              {!cargando &&
                ausentes.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center"
                    >
                      <div className="text-5xl">
                        ✅
                      </div>

                      <p className="mt-4 font-black text-slate-700">
                        No se encontraron
                        estudiantes ausentes
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Los estudiantes aparecerán
                        después de finalizar su
                        turno si no registraron
                        entrada.
                      </p>
                    </td>
                  </tr>
                )}

              {cargando && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center font-semibold text-slate-500"
                  >
                    Cargando estudiantes
                    ausentes...
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

function Indicador({
  titulo,
  valor,
  icono,
  clase,
}: {
  titulo: string;
  valor: string | number;
  icono: string;
  clase: string;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${clase}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black opacity-75">
            {titulo}
          </p>

          <p className="mt-3 text-3xl font-black">
            {valor}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm">
          {icono}
        </div>
      </div>
    </div>
  );
}

function CampoFiltro({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-600">
        {titulo}
      </label>

      {children}
    </div>
  );
}