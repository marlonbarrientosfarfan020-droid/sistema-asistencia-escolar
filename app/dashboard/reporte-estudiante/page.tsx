"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Detalle = {
  id: number;
  fecha: string;
  entrada: string;
  salida: string;
  estado: string;
  metodo: string;
};

type Estudiante = {
  id: number;
  codigo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;
  turno: string;
};

export default function ReporteEstudiantePage() {
  const fechaActual = new Date();

  const [dni, setDni] = useState("");
  const [mes, setMes] = useState(fechaActual.getMonth() + 1);
  const [anio, setAnio] = useState(fechaActual.getFullYear());
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [detalle, setDetalle] = useState<Detalle[]>([]);
  const [mensaje, setMensaje] = useState("");

  async function buscarReporte() {
    if (!dni.trim()) {
      setMensaje("⚠️ Ingrese el DNI del estudiante");
      return;
    }

    setMensaje("⏳ Generando reporte del estudiante...");

    const res = await fetch(
      `/api/reportes/estudiante?dni=${dni}&mes=${mes}&anio=${anio}`,
      {
        headers: {
          "x-user-role": localStorage.getItem("rol") || "",
        },
      }
    );

    const data = await res.json();

    if (res.ok) {
      setEstudiante(data.estudiante);
      setResumen(data.resumen);
      setDetalle(data.detalle);
      setMensaje("✅ Reporte generado correctamente");
    } else {
      setEstudiante(null);
      setResumen(null);
      setDetalle([]);
      setMensaje(`❌ ${data.message || "Error al generar reporte"}`);
    }
  }

  function fecha(fecha: string) {
    return new Date(fecha).toLocaleDateString("es-PE");
  }

  function exportarExcel() {
    if (!estudiante || detalle.length === 0) return;

    const datosExcel = detalle.map((item) => ({
      Fecha: fecha(item.fecha),
      Entrada: item.entrada,
      Salida: item.salida,
      Estado: item.estado,
      Metodo: item.metodo,
    }));

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Reporte Estudiante");

    XLSX.writeFile(
      libro,
      `Reporte_${estudiante.dni}_${mes}_${anio}.xlsx`
    );
  }

  function exportarPDF() {
    if (!estudiante) return;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("I.E. Santa Rita de Casia", 105, 15, { align: "center" });

    doc.setFontSize(13);
    doc.text("Reporte Individual de Asistencia", 105, 24, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Estudiante: ${estudiante.nombres} ${estudiante.apellidos}`, 14, 38);
    doc.text(`DNI: ${estudiante.dni}`, 14, 45);
    doc.text(`Grado: ${estudiante.grado} - ${estudiante.seccion}`, 70, 45);
    doc.text(`Turno: ${estudiante.turno}`, 130, 45);
    doc.text(`Mes: ${mes}/${anio}`, 14, 52);

    if (resumen) {
      doc.text(`Presentes: ${resumen.presentes}`, 14, 60);
      doc.text(`Ausentes: ${resumen.ausentes}`, 50, 60);
      doc.text(`Puntuales: ${resumen.puntuales}`, 90, 60);
      doc.text(`Tardanzas: ${resumen.tardanzas}`, 130, 60);
      doc.text(`Sin salida: ${resumen.sinSalida}`, 170, 60);
    }

    autoTable(doc, {
      startY: 70,
      head: [["Fecha", "Entrada", "Salida", "Estado", "Método"]],
      body: detalle.map((item) => [
        fecha(item.fecha),
        item.entrada,
        item.salida,
        item.estado,
        item.metodo,
      ]),
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
    });

    doc.save(`Reporte_${estudiante.dni}_${mes}_${anio}.pdf`);
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-8">
        Reporte Individual por Estudiante
      </h2>

      <div className="bg-white rounded-3xl shadow p-6">
        <div className="grid md:grid-cols-5 gap-5">
          <input
            value={dni}
            onChange={(e) =>
              setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="DNI del estudiante"
            className="border rounded-xl p-3"
          />

          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="border rounded-xl p-3"
          >
            <option value={1}>Enero</option>
            <option value={2}>Febrero</option>
            <option value={3}>Marzo</option>
            <option value={4}>Abril</option>
            <option value={5}>Mayo</option>
            <option value={6}>Junio</option>
            <option value={7}>Julio</option>
            <option value={8}>Agosto</option>
            <option value={9}>Septiembre</option>
            <option value={10}>Octubre</option>
            <option value={11}>Noviembre</option>
            <option value={12}>Diciembre</option>
          </select>

          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="border rounded-xl p-3"
          />

          <button
            onClick={buscarReporte}
            className="bg-slate-900 text-white rounded-xl px-5 py-3 font-bold"
          >
            🔍 Buscar
          </button>

          <div className="flex gap-3">
            <button
              onClick={exportarExcel}
              disabled={!estudiante || detalle.length === 0}
              className="bg-green-600 text-white rounded-xl px-5 py-3 font-bold disabled:opacity-40"
            >
              Excel
            </button>

            <button
              onClick={exportarPDF}
              disabled={!estudiante}
              className="bg-red-600 text-white rounded-xl px-5 py-3 font-bold disabled:opacity-40"
            >
              PDF
            </button>
          </div>
        </div>

        {mensaje && <p className="mt-5 font-bold">{mensaje}</p>}
      </div>

      {estudiante && resumen && (
        <>
          <div className="bg-white rounded-3xl shadow p-6 mt-8">
            <h3 className="text-2xl font-bold mb-4">
              👨‍🎓 {estudiante.nombres} {estudiante.apellidos}
            </h3>

            <div className="grid md:grid-cols-4 gap-4 text-sm font-bold">
              <div className="bg-slate-100 rounded-xl p-4">
                DNI: {estudiante.dni}
              </div>
              <div className="bg-slate-100 rounded-xl p-4">
                Código: {estudiante.codigo}
              </div>
              <div className="bg-slate-100 rounded-xl p-4">
                Grado: {estudiante.grado} - {estudiante.seccion}
              </div>
              <div className="bg-slate-100 rounded-xl p-4">
                Turno: {estudiante.turno}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mt-8">
            <Card titulo="✅ Presentes" valor={resumen.presentes} />
            <Card titulo="❌ Ausentes" valor={resumen.ausentes} />
            <Card titulo="🟢 Puntuales" valor={resumen.puntuales} />
            <Card titulo="🟠 Tardanzas" valor={resumen.tardanzas} />
            <Card titulo="🔵 Sin salida" valor={resumen.sinSalida} />
          </div>
        </>
      )}

      <div className="bg-white rounded-3xl shadow p-6 mt-8">
        <h3 className="text-2xl font-bold mb-5">
          Detalle de asistencias del mes
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b">
                <th className="py-3">Fecha</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
                <th>Método</th>
              </tr>
            </thead>

            <tbody>
              {detalle.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3">{fecha(item.fecha)}</td>
                  <td>{item.entrada}</td>
                  <td>{item.salida}</td>
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        item.estado === "TARDE"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {item.estado}
                    </span>
                  </td>
                  <td>{item.metodo}</td>
                </tr>
              ))}

              {detalle.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Busque un estudiante para ver su reporte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="bg-white rounded-3xl shadow p-5">
      <p className="text-slate-500 font-bold">{titulo}</p>
      <h3 className="text-3xl font-extrabold mt-2">{valor}</h3>
    </div>
  );
}