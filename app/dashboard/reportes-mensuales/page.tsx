"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Detalle = {
  id: number;
  estudiante: string;
  dni: string;
  grado: string;
  gradoSolo?: string;
  seccion?: string;
  turno: string;
  presentes: number;
  ausentes: number;
  puntuales: number;
  tardanzas: number;
  sinSalida: number;
};

export default function ReportesMensualesPage() {
  const fecha = new Date();

  const [mes, setMes] = useState(fecha.getMonth() + 1);
  const [anio, setAnio] = useState(fecha.getFullYear());
  const [turno, setTurno] = useState("TODOS");
  const [grado, setGrado] = useState("TODOS");
  const [seccion, setSeccion] = useState("TODOS");

  const [detalle, setDetalle] = useState<Detalle[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [mensaje, setMensaje] = useState("");

  async function buscarReporte() {
    setMensaje("⏳ Generando reporte mensual...");

    const params = new URLSearchParams({
      mes: String(mes),
      anio: String(anio),
      turno,
      grado,
      seccion,
    });

    const res = await fetch(`/api/reportes/mensual?${params.toString()}`, {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    const data = await res.json();

    if (res.ok) {
      setResumen(data.resumen);
      setDetalle(data.detalle);
      setMensaje("✅ Reporte generado correctamente");
    } else {
      setMensaje(`❌ ${data.message || "Error al generar reporte"}`);
    }
  }

  function exportarExcel() {
    if (detalle.length === 0) return;

    const datosExcel = detalle.map((item) => ({
      Estudiante: item.estudiante,
      DNI: item.dni,
      Grado: item.grado,
      Turno: item.turno,
      Presentes: item.presentes,
      Ausentes: item.ausentes,
      Puntuales: item.puntuales,
      Tardanzas: item.tardanzas,
      "Sin salida": item.sinSalida,
    }));

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Reporte Mensual");

    XLSX.writeFile(
      libro,
      `Reporte_Mensual_${mes}_${anio}_${turno}_${grado}_${seccion}.xlsx`
    );
  }

  function exportarPDF() {
    if (detalle.length === 0) return;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("I.E. Santa Rita de Casia", 105, 15, { align: "center" });

    doc.setFontSize(13);
    doc.text("Reporte Mensual de Asistencias", 105, 24, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Mes: ${mes}/${anio}`, 14, 38);
    doc.text(`Turno: ${turno}`, 55, 38);
    doc.text(`Grado: ${grado}`, 95, 38);
    doc.text(`Sección: ${seccion}`, 140, 38);

    if (resumen) {
      doc.text(`Estudiantes: ${resumen.totalEstudiantes}`, 14, 46);
      doc.text(`Presentes: ${resumen.totalPresentes}`, 55, 46);
      doc.text(`Ausentes: ${resumen.totalAusentes}`, 95, 46);
      doc.text(`Tardanzas: ${resumen.totalTardanzas}`, 140, 46);
    }

    autoTable(doc, {
      startY: 58,
      head: [
        [
          "Estudiante",
          "DNI",
          "Grado",
          "Turno",
          "Presentes",
          "Ausentes",
          "Puntuales",
          "Tardanzas",
          "Sin salida",
        ],
      ],
      body: detalle.map((item) => [
        item.estudiante,
        item.dni,
        item.grado,
        item.turno,
        item.presentes,
        item.ausentes,
        item.puntuales,
        item.tardanzas,
        item.sinSalida,
      ]),
      styles: {
        fontSize: 7,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
    });

    doc.save(`Reporte_Mensual_${mes}_${anio}_${turno}_${grado}_${seccion}.pdf`);
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-8">Reportes Mensuales</h2>

      <div className="bg-white rounded-3xl shadow p-6">
        <div className="grid md:grid-cols-5 gap-5">
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

          <select
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="TODOS">Todos los turnos</option>
            <option value="MAÑANA">MAÑANA</option>
            <option value="TARDE">TARDE</option>
            <option value="NOCHE">NOCHE</option>
          </select>

          <select
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="TODOS">Todos los grados</option>
            <option value="1">1°</option>
            <option value="2">2°</option>
            <option value="3">3°</option>
            <option value="4">4°</option>
            <option value="5">5°</option>
            <option value="6">6°</option>
          </select>

          <select
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="TODOS">Todas las secciones</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="G">G</option>
             <option value="H">H</option>
          </select>

          <button
            onClick={buscarReporte}
            className="bg-slate-900 text-white rounded-xl px-5 py-3 font-bold"
          >
            🔍 Generar reporte
          </button>

          <button
            onClick={exportarExcel}
            disabled={detalle.length === 0}
            className="bg-green-600 text-white rounded-xl px-5 py-3 font-bold disabled:opacity-40"
          >
            📊 Excel
          </button>

          <button
            onClick={exportarPDF}
            disabled={detalle.length === 0}
            className="bg-red-600 text-white rounded-xl px-5 py-3 font-bold disabled:opacity-40"
          >
            📄 PDF
          </button>
        </div>

        {mensaje && <p className="mt-5 font-bold">{mensaje}</p>}
      </div>

      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-5 mt-8">
          <Card titulo="👨‍🎓 Estudiantes" valor={resumen.totalEstudiantes} />
          <Card titulo="✅ Presentes" valor={resumen.totalPresentes} />
          <Card titulo="❌ Ausentes" valor={resumen.totalAusentes} />
          <Card titulo="🟢 Puntuales" valor={resumen.totalPuntuales} />
          <Card titulo="🟠 Tardanzas" valor={resumen.totalTardanzas} />
          <Card titulo="🔵 Sin salida" valor={resumen.totalSinSalida} />
        </div>
      )}

      <div className="bg-white rounded-3xl shadow p-6 mt-8">
        <h3 className="text-2xl font-bold mb-5">Detalle por estudiante</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b">
                <th className="py-3">Estudiante</th>
                <th>DNI</th>
                <th>Grado</th>
                <th>Turno</th>
                <th>Presentes</th>
                <th>Ausentes</th>
                <th>Puntuales</th>
                <th>Tardanzas</th>
                <th>Sin salida</th>
              </tr>
            </thead>

            <tbody>
              {detalle.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3 font-bold">{item.estudiante}</td>
                  <td>{item.dni}</td>
                  <td>{item.grado}</td>
                  <td>{item.turno}</td>
                  <td>{item.presentes}</td>
                  <td>{item.ausentes}</td>
                  <td>{item.puntuales}</td>
                  <td>{item.tardanzas}</td>
                  <td>{item.sinSalida}</td>
                </tr>
              ))}

              {detalle.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    Genere un reporte para ver resultados.
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