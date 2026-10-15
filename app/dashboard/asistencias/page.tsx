"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Card from "@/components/ui/Card";

type Asistencia = {
  id: number;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  metodo: string;
  estado: string;
  estadoJornada?: string;
  estadoSalida?: string | null;
  estudiante: {
    dni: string;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
    turno?: {
      id: number;
      nombre: string;
    } | null;
  };
};

type GradoSeccionItem = {
  grado: string;
  seccion: string;
  etiqueta: string;
};

function fechaHoyPeru(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function formatoHora(fecha: string | null) {
  if (!fecha) return "-";

  return new Date(fecha).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

export default function AsistenciasPage() {
  const [fecha, setFecha] = useState(fechaHoyPeru());
  const [turnoFiltro, setTurnoFiltro] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [gradoSeccion, setGradoSeccion] = useState("");
  const [gradoSeccionDebounced, setGradoSeccionDebounced] = useState("");

  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(25);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [gradosSeccionesDisponibles, setGradosSeccionesDisponibles] = useState<GradoSeccionItem[]>([]);

  const fetchIdRef = useRef(0);

  // Debounce para búsqueda por apellidos y nombres (350 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Debounce para búsqueda por grado y sección (350 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setGradoSeccionDebounced(gradoSeccion);
    }, 350);
    return () => clearTimeout(timer);
  }, [gradoSeccion]);

  // Resetear paginación a página 1 al cambiar cualquier filtro de búsqueda
  useEffect(() => {
    setPagina(1);
  }, [fecha, turnoFiltro, busquedaDebounced, gradoSeccionDebounced, limite]);

  // Consulta real al backend con filtros combinados y paginación
  const cargarAsistencias = useCallback(
    async (paginaDestino: number) => {
      const currentFetchId = ++fetchIdRef.current;
      setCargando(true);

      try {
        const params = new URLSearchParams({
          fecha,
          turno: turnoFiltro,
          busqueda: busquedaDebounced,
          gradoSeccion: gradoSeccionDebounced,
          page: String(paginaDestino),
          limit: String(limite),
          formato: "paginado",
        });

        const res = await fetch(`/api/asistencias?${params.toString()}`);
        if (!res.ok) throw new Error("Error consultando asistencias");
        const data = await res.json();

        // Evitar que respuestas desfasadas sobrescriban la búsqueda más reciente
        if (currentFetchId !== fetchIdRef.current) return;

        if (Array.isArray(data)) {
          setAsistencias(data);
          setTotal(data.length);
          setTotalPaginas(1);
        } else {
          setAsistencias(data.asistencias || []);
          setTotal(data.total || 0);
          setTotalPaginas(data.totalPaginas || 1);
          if (Array.isArray(data.gradosSecciones) && data.gradosSecciones.length > 0) {
            setGradosSeccionesDisponibles(data.gradosSecciones);
          }
        }
      } catch (error) {
        if (currentFetchId !== fetchIdRef.current) return;
        console.error("Error al cargar asistencias:", error);
        setAsistencias([]);
        setTotal(0);
        setTotalPaginas(1);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setCargando(false);
        }
      }
    },
    [fecha, turnoFiltro, busquedaDebounced, gradoSeccionDebounced, limite]
  );

  useEffect(() => {
    cargarAsistencias(pagina);
  }, [cargarAsistencias, pagina]);

  function limpiarBusqueda() {
    setBusqueda("");
    setBusquedaDebounced("");
  }

  function limpiarGradoSeccion() {
    setGradoSeccion("");
    setGradoSeccionDebounced("");
  }

  function limpiarTodosFiltros() {
    setBusqueda("");
    setBusquedaDebounced("");
    setGradoSeccion("");
    setGradoSeccionDebounced("");
    setTurnoFiltro("TODOS");
  }

  const hayFiltrosActivos =
    busqueda.trim() !== "" ||
    gradoSeccion.trim() !== "" ||
    turnoFiltro !== "TODOS";

  // Obtener el dataset completo coincidente con los filtros actuales para la exportación
  async function obtenerDatosParaExportar(): Promise<Asistencia[]> {
    const params = new URLSearchParams({
      fecha,
      turno: turnoFiltro,
      busqueda: busquedaDebounced,
      gradoSeccion: gradoSeccionDebounced,
      exportar: "true",
    });

    const res = await fetch(`/api/asistencias?${params.toString()}`);
    if (!res.ok) throw new Error("Error obteniendo datos para exportar");
    const data = await res.json();

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.asistencias)) return data.asistencias;
    return [];
  }

  async function exportarExcel() {
    try {
      setExportando(true);
      const datosCompletos = await obtenerDatosParaExportar();

      if (datosCompletos.length === 0) {
        alert("No hay registros para exportar con los filtros seleccionados.");
        return;
      }

      const datos = datosCompletos.map((asistencia) => ({
        Estudiante: `${asistencia.estudiante.nombres} ${asistencia.estudiante.apellidos}`,
        DNI: asistencia.estudiante.dni,
        Grado: `${asistencia.estudiante.grado} - ${asistencia.estudiante.seccion}`,
        Turno: asistencia.estudiante.turno?.nombre || "Sin turno",
        "Hora Entrada": formatoHora(asistencia.horaEntrada),
        "Estado Entrada": asistencia.estado,
        "Hora Salida": formatoHora(asistencia.horaSalida),
        "Estado Salida":
          asistencia.estadoSalida ||
          (asistencia.horaSalida
            ? "REGISTRADA"
            : asistencia.estadoJornada === "SIN_SALIDA"
              ? "SIN_SALIDA"
              : "PENDIENTE"),
        "Estado Jornada":
          asistencia.estadoJornada ||
          (asistencia.horaSalida ? "CERRADA" : "ABIERTA"),
        Método: asistencia.metodo,
      }));

      const hoja = XLSX.utils.json_to_sheet(datos);
      const libro = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(libro, hoja, "Asistencias");

      let sufijo = "";
      if (gradoSeccionDebounced.trim()) {
        sufijo += `_${gradoSeccionDebounced.trim().replace(/[^a-zA-Z0-9]/g, "")}`;
      }
      if (turnoFiltro !== "TODOS") {
        sufijo += `_${turnoFiltro}`;
      }

      XLSX.writeFile(libro, `Asistencias_${fecha}${sufijo}.xlsx`);
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("Ocurrió un error al generar la exportación Excel.");
    } finally {
      setExportando(false);
    }
  }

  async function exportarPDF() {
    try {
      setExportando(true);
      const datosCompletos = await obtenerDatosParaExportar();

      if (datosCompletos.length === 0) {
        alert("No hay registros para exportar con los filtros seleccionados.");
        return;
      }

      const doc = new jsPDF();
      const logo = "/img/logo-santa-rita.png";

      try {
        doc.addImage(logo, "PNG", 14, 10, 22, 28);
      } catch {
        // Logo opcional si la ruta externa no se procesa
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("I.E. Santa Rita de Casia", 105, 18, { align: "center" });

      doc.setFontSize(13);
      doc.text("Reporte de Asistencias", 105, 27, { align: "center" });

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha: ${fecha}`, 14, 43);
      doc.text(`Turno: ${turnoFiltro}`, 14, 49);

      let lineaExtra = 49;
      if (gradoSeccionDebounced.trim()) {
        lineaExtra += 6;
        doc.text(`Grado y Sección: ${gradoSeccionDebounced.trim().toUpperCase()}`, 14, lineaExtra);
      }
      if (busquedaDebounced.trim()) {
        lineaExtra += 6;
        doc.text(`Búsqueda: ${busquedaDebounced.trim()}`, 14, lineaExtra);
      }

      doc.text(`Total registros: ${datosCompletos.length}`, 140, 43);
      doc.text(
        `Generado: ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}`,
        140,
        49
      );

      const tableStartY = Math.max(60, lineaExtra + 8);

      autoTable(doc, {
        startY: tableStartY,
        head: [
          [
            "Estudiante",
            "DNI",
            "Grado",
            "Turno",
            "Hora Entrada",
            "Estado Entrada",
            "Hora Salida",
            "Estado Salida",
            "Método",
          ],
        ],
        body: datosCompletos.map((asistencia) => [
          `${asistencia.estudiante.nombres} ${asistencia.estudiante.apellidos}`,
          asistencia.estudiante.dni,
          `${asistencia.estudiante.grado} - ${asistencia.estudiante.seccion}`,
          asistencia.estudiante.turno?.nombre || "Sin turno",
          formatoHora(asistencia.horaEntrada),
          asistencia.estado,
          formatoHora(asistencia.horaSalida),
          asistencia.estadoSalida ||
            (asistencia.horaSalida
              ? "REGISTRADA"
              : asistencia.estadoJornada === "SIN_SALIDA"
                ? "SIN_SALIDA"
                : "PENDIENTE"),
          asistencia.metodo,
        ]),
        styles: {
          fontSize: 7.5,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 80;

      doc.setFontSize(10);
      doc.text("_____________________________", 130, finalY + 25);
      doc.text("Responsable de asistencia", 138, finalY + 32);

      let sufijo = "";
      if (gradoSeccionDebounced.trim()) {
        sufijo += `_${gradoSeccionDebounced.trim().replace(/[^a-zA-Z0-9]/g, "")}`;
      }
      if (turnoFiltro !== "TODOS") {
        sufijo += `_${turnoFiltro}`;
      }

      doc.save(`Reporte_Asistencias_${fecha}${sufijo}.pdf`);
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      alert("Ocurrió un error al generar la exportación PDF.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      {/* TÍTULO Y DESCRIPCIÓN PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Asistencias
          </h2>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">
            Control de asistencia escolar en tiempo real con filtros avanzados y exportación oficial.
          </p>
        </div>
      </div>

      <Card>
        {/* CABECERA: TÍTULO DEL MÓDULO, SELECTOR DE FECHA, TURNO Y BOTONES DE EXPORTACIÓN */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              Registro de asistencias
            </h3>
            <p className="text-slate-500 text-sm mt-0.5">
              Filtra por fecha, turno, apellidos y nombres, o grado y sección.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-slate-400 text-sm">📅</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-800 outline-none"
                title="Filtrar por fecha"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-slate-400 text-sm">⏰</span>
              <select
                value={turnoFiltro}
                onChange={(e) => setTurnoFiltro(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-800 outline-none cursor-pointer"
                title="Filtrar por turno"
              >
                <option value="TODOS">Todos los turnos</option>
                <option value="MAÑANA">MAÑANA</option>
                <option value="TARDE">TARDE</option>
                <option value="NOCHE">NOCHE</option>
              </select>
            </div>

            <button
              onClick={exportarExcel}
              disabled={exportando}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50"
              title="Descargar reporte en formato Excel"
            >
              <span>📊</span>
              <span>{exportando ? "Exportando..." : "Exportar Excel"}</span>
            </button>

            <button
              onClick={exportarPDF}
              disabled={exportando}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50"
              title="Descargar reporte en formato PDF"
            >
              <span>📄</span>
              <span>{exportando ? "Exportando..." : "Exportar PDF"}</span>
            </button>
          </div>
        </div>

        {/* FILA DE BUSCADORES ESPECIALIZADOS */}
        <div className="pt-5 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            {/* BUSCADOR 1: APELLIDOS Y NOMBRES */}
            <div className="md:col-span-7 lg:col-span-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Buscar por apellidos y nombres
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-base">
                  🔍
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por apellidos y nombres..."
                  className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition outline-none"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={limpiarBusqueda}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    title="Limpiar búsqueda de estudiante"
                  >
                    <span className="bg-slate-200 hover:bg-slate-300 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-600">
                      ✕
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* BUSCADOR 2: GRADO Y SECCIÓN */}
            <div className="md:col-span-5 lg:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Grado y sección
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-base">
                  🎓
                </span>
                <input
                  type="text"
                  value={gradoSeccion}
                  onChange={(e) => setGradoSeccion(e.target.value)}
                  list="lista-grados-secciones"
                  placeholder="Ej: 5-C, 4-A, 5..."
                  className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition outline-none uppercase"
                />
                <datalist id="lista-grados-secciones">
                  {gradosSeccionesDisponibles.map((item) => (
                    <option key={item.etiqueta} value={item.etiqueta}>
                      {`Grado ${item.grado} - Sección ${item.seccion}`}
                    </option>
                  ))}
                </datalist>
                {gradoSeccion && (
                  <button
                    type="button"
                    onClick={limpiarGradoSeccion}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    title="Limpiar filtro de grado y sección"
                  >
                    <span className="bg-slate-200 hover:bg-slate-300 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-600">
                      ✕
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* BOTÓN LIMPIAR FILTROS (SI HAY ALGUNO ACTIVO) */}
            <div className="md:col-span-12 lg:col-span-2 flex items-center">
              {hayFiltrosActivos ? (
                <button
                  type="button"
                  onClick={limpiarTodosFiltros}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition border border-slate-200"
                  title="Restablecer todos los filtros a sus valores predeterminados"
                >
                  <span>🔄</span>
                  <span>Limpiar filtros</span>
                </button>
              ) : (
                <div className="hidden lg:block text-xs text-slate-400 italic py-2">
                  Filtros activos: Ninguno
                </div>
              )}
            </div>
          </div>

          {/* INDICADOR DISCRETO DE BÚSQUEDA Y CONTADOR DE RESULTADOS */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {cargando ? (
                <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  Buscando asistencias...
                </span>
              ) : (
                <span>
                  Mostrando <strong className="text-slate-800">{asistencias.length}</strong> de{" "}
                  <strong className="text-slate-800">{total}</strong> asistencias encontradas
                </span>
              )}

              {/* BADGES DE FILTROS ACTIVOS */}
              {busquedaDebounced && (
                <span className="hidden sm:inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium text-xs">
                  Estudiante: &ldquo;{busquedaDebounced}&rdquo;
                </span>
              )}
              {gradoSeccionDebounced && (
                <span className="hidden sm:inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-medium text-xs uppercase">
                  Grado/Sección: {gradoSeccionDebounced}
                </span>
              )}
            </div>

            {totalPaginas > 1 && (
              <div className="text-slate-500 font-medium">
                Página <strong className="text-slate-800">{pagina}</strong> de{" "}
                <strong className="text-slate-800">{totalPaginas}</strong>
              </div>
            )}
          </div>
        </div>

        {/* TABLA DE ASISTENCIAS */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left min-w-[1000px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3.5 px-4">Estudiante</th>
                <th className="py-3.5 px-3">DNI</th>
                <th className="py-3.5 px-3">Grado</th>
                <th className="py-3.5 px-3">Turno</th>
                <th className="py-3.5 px-3">Hora Entrada</th>
                <th className="py-3.5 px-3">Estado Entrada</th>
                <th className="py-3.5 px-3">Hora Salida</th>
                <th className="py-3.5 px-3">Estado Salida</th>
                <th className="py-3.5 px-4">Método</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {asistencias.map((asistencia) => {
                const estadoEntrada = asistencia.estado;
                const salidaRegistrada = Boolean(asistencia.horaSalida);
                const fueraHorario = asistencia.estadoSalida === "FUERA_HORARIO";

                return (
                  <tr key={asistencia.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {asistencia.estudiante.nombres} {asistencia.estudiante.apellidos}
                    </td>

                    <td className="py-3.5 px-3 text-slate-600 font-mono text-xs">
                      {asistencia.estudiante.dni}
                    </td>

                    <td className="py-3.5 px-3 font-medium text-slate-700">
                      {asistencia.estudiante.grado} - {asistencia.estudiante.seccion}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-0.5 rounded-full text-xs font-bold">
                        {asistencia.estudiante.turno?.nombre || "Sin turno"}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-slate-800">
                      {formatoHora(asistencia.horaEntrada)}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          estadoEntrada === "TARDE"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {estadoEntrada}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-slate-800">
                      {formatoHora(asistencia.horaSalida)}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          salidaRegistrada
                            ? fueraHorario
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                            : asistencia.estadoJornada === "SIN_SALIDA"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {asistencia.estadoSalida ||
                          (salidaRegistrada
                            ? "REGISTRADA"
                            : asistencia.estadoJornada === "SIN_SALIDA"
                              ? "SIN SALIDA"
                              : "PENDIENTE")}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-medium text-xs">
                      {asistencia.metodo}
                    </td>
                  </tr>
                );
              })}

              {asistencias.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    {cargando ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-semibold text-slate-600">
                          Buscando registros de asistencias...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <span className="text-4xl mb-1">📋</span>
                        <p className="font-bold text-slate-800 text-base">
                          No se encontraron asistencias
                        </p>
                        <p className="text-slate-500 text-xs sm:text-sm">
                          {hayFiltrosActivos
                            ? "No hay registros que coincidan con los criterios de búsqueda aplicados. Intente ajustar o limpiar los filtros."
                            : "No hay asistencias registradas para la fecha seleccionada."}
                        </p>
                        {hayFiltrosActivos && (
                          <button
                            type="button"
                            onClick={limpiarTodosFiltros}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition"
                          >
                            <span>🔄</span>
                            <span>Limpiar filtros de búsqueda</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CONTROLES DE PAGINACIÓN */}
        {totalPaginas > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Registros por página:</span>
              <select
                value={limite}
                onChange={(e) => {
                  setLimite(Number(e.target.value));
                  setPagina(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-semibold outline-none"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                Mostrando {Math.min((pagina - 1) * limite + 1, total)} -{" "}
                {Math.min(pagina * limite, total)} de {total}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1 || cargando}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition"
              >
                ← Anterior
              </button>

              {/* Botones de páginas con ventana deslizante */}
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPaginas <= 7) return true;
                  if (p === 1 || p === totalPaginas) return true;
                  return Math.abs(p - pagina) <= 1;
                })
                .map((p, index, array) => {
                  const mostrarSeparador = index > 0 && p - array[index - 1] > 1;
                  return (
                    <span key={p} className="flex items-center">
                      {mostrarSeparador && (
                        <span className="px-1 text-slate-400 text-xs">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPagina(p)}
                        disabled={cargando}
                        className={`min-w-[32px] h-8 rounded-xl text-xs font-bold transition ${
                          pagina === p
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}

              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas || cargando}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}