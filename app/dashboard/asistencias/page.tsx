"use client";

import { useEffect, useState } from "react";
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

export default function AsistenciasPage() {
  const hoy = new Date().toISOString().split("T")[0];

  const [fecha, setFecha] = useState(hoy);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [turnoFiltro, setTurnoFiltro] = useState("TODOS");

  async function cargarAsistencias() {
    const res = await fetch(`/api/asistencias?fecha=${fecha}`);
    const data = await res.json();
    setAsistencias(data);
  }

  useEffect(() => {
    cargarAsistencias();
  }, [fecha]);

  function formatoHora(fecha: string | null) {
    if (!fecha) return "-";

    return new Date(fecha).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const asistenciasFiltradas = asistencias.filter((asistencia) => {
    if (turnoFiltro === "TODOS") return true;
    return asistencia.estudiante.turno?.nombre === turnoFiltro;
  });

  function exportarExcel() {
    const datos = asistenciasFiltradas.map((asistencia) => ({
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
    XLSX.writeFile(libro, `Asistencias_${fecha}.xlsx`);
  }

  function exportarPDF() {
    const doc = new jsPDF();

    const logo = "/img/logo-santa-rita.png";

    doc.addImage(logo, "PNG", 14, 10, 22, 28);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("I.E. Santa Rita de Casia", 105, 18, { align: "center" });

    doc.setFontSize(13);
    doc.text("Reporte de Asistencias", 105, 27, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${fecha}`, 14, 45);
    doc.text(`Turno: ${turnoFiltro}`, 14, 52);
    doc.text(`Generado: ${new Date().toLocaleString("es-PE")}`, 14, 59);

    autoTable(doc, {
      startY: 68,
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
      body: asistenciasFiltradas.map((asistencia) => [
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

    const finalY = (doc as any).lastAutoTable.finalY || 80;

    doc.setFontSize(10);
    doc.text("_____________________________", 130, finalY + 25);
    doc.text("Responsable de asistencia", 138, finalY + 32);

    doc.save(`Reporte_Asistencias_${fecha}.pdf`);
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-6">Asistencias</h2>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Registro de asistencias</h3>
            <p className="text-slate-500 mt-1">
              Filtra por fecha y turno.
            </p>
          </div>

          <div className="flex gap-3">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border rounded-xl p-3"
            />

            <select
              value={turnoFiltro}
              onChange={(e) => setTurnoFiltro(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="TODOS">Todos los turnos</option>
              <option value="MAÑANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
              <option value="NOCHE">NOCHE</option>
            </select>

            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-5 rounded-xl font-bold hover:bg-green-700"
            >
              📊 Exportar Excel
            </button>

            <button
              onClick={exportarPDF}
              className="bg-red-600 text-white px-5 rounded-xl font-bold hover:bg-red-700"
            >
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="border-b">
                <th className="py-3">Estudiante</th>
                <th>DNI</th>
                <th>Grado</th>
                <th>Turno</th>
                <th>Hora Entrada</th>
                <th>Estado Entrada</th>
                <th>Hora Salida</th>
                <th>Estado Salida</th>
                <th>Método</th>
              </tr>
            </thead>

            <tbody>
              {asistenciasFiltradas.map((asistencia) => {
                const estadoEntrada = asistencia.estado;
                const salidaRegistrada = Boolean(asistencia.horaSalida);
                const fueraHorario = asistencia.estadoSalida === "FUERA_HORARIO";

                return (
                  <tr key={asistencia.id} className="border-b">
                    <td className="py-3 font-semibold">
                      {asistencia.estudiante.nombres}{" "}
                      {asistencia.estudiante.apellidos}
                    </td>

                    <td>{asistencia.estudiante.dni}</td>

                    <td>
                      {asistencia.estudiante.grado} -{" "}
                      {asistencia.estudiante.seccion}
                    </td>

                    <td>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                        {asistencia.estudiante.turno?.nombre || "Sin turno"}
                      </span>
                    </td>

                    <td className="font-bold">{formatoHora(asistencia.horaEntrada)}</td>
                    <td>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          estadoEntrada === "TARDE"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {estadoEntrada}
                      </span>
                    </td>

                    <td className="font-bold">{formatoHora(asistencia.horaSalida)}</td>
                    <td>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          salidaRegistrada
                            ? fueraHorario
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                            : asistencia.estadoJornada === "SIN_SALIDA"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
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

                    <td className="text-slate-500 font-medium">{asistencia.metodo}</td>
                  </tr>
                );
              })}

              {asistenciasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    No hay asistencias registradas para esta fecha o turno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}