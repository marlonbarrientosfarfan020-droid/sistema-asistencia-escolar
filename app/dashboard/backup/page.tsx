"use client";

import { useState } from "react";

export default function BackupPage() {
  const [mensaje, setMensaje] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  async function descargarBackup() {
    setMensaje("⏳ Generando backup...");

    const res = await fetch("/api/backup", {
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
    });

    if (!res.ok) {
      const data = await res.json();
      setMensaje(`❌ ${data.message || "Error al generar backup"}`);
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_asistencia_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();

    window.URL.revokeObjectURL(url);

    setMensaje("✅ Backup descargado correctamente");
  }

  async function restaurarBackup() {
    if (!archivo) {
      setMensaje("⚠️ Seleccione un archivo backup .json");
      return;
    }

    const confirmar = confirm(
      "⚠️ Esta acción reemplazará estudiantes, turnos, asistencias, configuración y auditoría. ¿Deseas continuar?"
    );

    if (!confirmar) return;

    setRestaurando(true);
    setMensaje("⏳ Restaurando backup...");

    const formData = new FormData();
    formData.append("archivo", archivo);

    const res = await fetch("/api/backup/restaurar", {
      method: "POST",
      headers: {
        "x-user-role": localStorage.getItem("rol") || "",
      },
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje("✅ Backup restaurado correctamente");
      setArchivo(null);
    } else {
      setMensaje(`❌ ${data.message || "Error al restaurar backup"}`);
    }

    setRestaurando(false);
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-8">Backup del Sistema</h2>

      <div className="bg-white rounded-3xl shadow p-6">
        <h3 className="text-2xl font-bold mb-4">💾 Copia de seguridad</h3>

        <p className="text-slate-600 mb-6">
          Descarga una copia de seguridad con estudiantes, turnos, asistencias,
          configuración y auditoría.
        </p>

        {mensaje && <p className="mb-5 font-bold">{mensaje}</p>}

        <button
          onClick={descargarBackup}
          className="bg-slate-900 text-white rounded-xl px-6 py-3 font-bold"
        >
          💾 Descargar backup
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow p-6 mt-8">
        <h3 className="text-2xl font-bold mb-4">♻️ Restaurar backup</h3>

        <p className="text-red-600 font-bold mb-5">
          Atención: restaurar un backup reemplazará la información actual del
          sistema.
        </p>

        <div className="flex gap-4 items-center">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="border rounded-xl p-3 flex-1"
          />

          <button
            onClick={restaurarBackup}
            disabled={restaurando}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 py-3 font-bold disabled:opacity-50"
          >
            {restaurando ? "Restaurando..." : "♻️ Restaurar"}
          </button>
        </div>
      </div>
    </>
  );
}