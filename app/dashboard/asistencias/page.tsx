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
  estudiante: {
    dni: string;
    nombres: string;
    apellidos: string;
    grado: string;
    seccion: string;
  };
};

export default function AsistenciasPage() {
  const hoy = new Date().toISOString().split("T")[0];

  const [fecha, setFecha] = useState(hoy);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [horaLimite, setHoraLimite] = useState("07:30");

  async function cargarAsistencias() {
    const res = await fetch(`/api/asistencias?fecha=${fecha}`);
    const data = await res.json();
    setAsistencias(data);
  }

  async function cargarConfiguracion() {
    const res = await fetch("/api/configuracion");
    const data = await res.json();
    setHoraLimite(data.horaEntrada || "07:30");
  }

  useEffect(() => {
    cargarConfiguracion();
  }, []);

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

  function estadoAsistencia(horaEntrada: string | null) {
    if (!horaEntrada) return "-";

    const entrada = new Date(horaEntrada);
    const [hora, minuto] = horaLimite.split(":").map(Number);

    const limite = new Date(entrada);
    limite.setHours(hora, minuto, 0, 0);

    return entrada > limite ? "Tardanza" : "Puntual";
  }

  function exportarExcel() {
    const datos = asistencias.map((asistencia) => ({
      Estudiante: `${asistencia.estudiante.nombres} ${asistencia.estudiante.apellidos}`,
      DNI: asistencia.estudiante.dni,
      Grado: `${asistencia.estudiante.grado} - ${asistencia.estudiante.seccion}`,
      Entrada: formatoHora(asistencia.horaEntrada),
      Salida: formatoHora(asistencia.horaSalida),
      Estado: estadoAsistencia(asistencia.horaEntrada),
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
  doc.text(`Hora límite de entrada: ${horaLimite}`, 14, 52);
  doc.text(
    `Generado: ${new Date().toLocaleString("es-PE")}`,
    14,
    59
  );

  autoTable(doc, {
    startY: 68,
    head: [
      ["Estudiante", "DNI", "Grado", "Entrada", "Salida", "Estado", "Método"],
    ],
    body: asistencias.map((asistencia) => [
      `${asistencia.estudiante.nombres} ${asistencia.estudiante.apellidos}`,
      asistencia.estudiante.dni,
      `${asistencia.estudiante.grado} - ${asistencia.estudiante.seccion}`,
      formatoHora(asistencia.horaEntrada),
      formatoHora(asistencia.horaSalida),
      estadoAsistencia(asistencia.horaEntrada),
      asistencia.metodo,
    ]),
    styles: {
      fontSize: 8,
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
              Hora límite de entrada: {horaLimite}
            </p>
          </div>

          <div className="flex gap-3">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border rounded-xl p-3"
            />

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

        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-3">Estudiante</th>
              <th>DNI</th>
              <th>Grado</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Estado</th>
              <th>Método</th>
            </tr>
          </thead>

          <tbody>
            {asistencias.map((asistencia) => {
              const estado = estadoAsistencia(asistencia.horaEntrada);

              return (
                <tr key={asistencia.id} className="border-b">
                  <td className="py-3">
                    {asistencia.estudiante.nombres}{" "}
                    {asistencia.estudiante.apellidos}
                  </td>
                  <td>{asistencia.estudiante.dni}</td>
                  <td>
                    {asistencia.estudiante.grado} -{" "}
                    {asistencia.estudiante.seccion}
                  </td>
                  <td>{formatoHora(asistencia.horaEntrada)}</td>
                  <td>{formatoHora(asistencia.horaSalida)}</td>
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        estado === "Tardanza"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {estado}
                    </span>
                  </td>
                  <td>{asistencia.metodo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}