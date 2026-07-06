"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

export default function ImportarEstudiantes({
  onImportado,
}: {
  onImportado: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  function descargarPlantilla() {
    const datos = [
      {
        codigo: "A001",
        dni: "12345678",
        nombres: "Juan",
        apellidos: "Pérez López",
        grado: "1",
        seccion: "A",
        nombreTutor: "María López",
        whatsapp: "51999999999",
        telegramChatId: "7530504168",
        turno: "MAÑANA",
      },
    ];

    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Plantilla");

    XLSX.writeFile(libro, "Plantilla_Importar_Estudiantes.xlsx");
  }

  async function importar() {
    if (!archivo) {
      setMensaje("⚠️ Seleccione un archivo Excel");
      return;
    }

    setCargando(true);
    setMensaje("⏳ Importando estudiantes...");

    const formData = new FormData();
    formData.append("archivo", archivo);

    const res = await fetch("/api/estudiantes/importar", {
      method: "POST",
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
        "x-user-name": localStorage.getItem("usuario") || "",
      },
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje(
        `✅ Importación finalizada. Importados: ${data.importados}. Errores: ${
          data.errores?.length || 0
        }`
      );
      setArchivo(null);
      onImportado();
    } else {
      setMensaje(`❌ ${data.message || "Error al importar"}`);
    }

    setCargando(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 mb-8">
      <h3 className="text-xl font-bold mb-4">
        📥 Importar estudiantes desde Excel
      </h3>

      {mensaje && <p className="mb-4 font-bold">{mensaje}</p>}

      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="border rounded-xl p-3 flex-1"
        />

        <button
          onClick={importar}
          disabled={cargando}
          className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-5 py-3 font-bold disabled:opacity-50"
        >
          {cargando ? "Importando..." : "📥 Importar"}
        </button>

        <button
          type="button"
          onClick={descargarPlantilla}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-3 font-bold"
        >
          📄 Descargar plantilla
        </button>
      </div>

      <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-blue-800 mb-2">
          La plantilla debe contener estas columnas:
        </p>

        <code className="text-blue-900">
          codigo | dni | nombres | apellidos | grado | seccion |
          nombreTutor | whatsapp | telegramChatId | turno
        </code>

        <p className="mt-3 text-slate-600">
          Valores válidos para <strong>turno</strong>: <strong>MAÑANA</strong>,
          <strong> TARDE</strong> o <strong>NOCHE</strong>.
        </p>
      </div>
    </div>
  );
}