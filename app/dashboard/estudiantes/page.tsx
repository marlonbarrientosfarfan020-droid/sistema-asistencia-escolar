"use client";

import { useState } from "react";
import EstudianteForm from "@/components/estudiantes/EstudianteForm";
import EstudianteTable from "@/components/estudiantes/EstudianteTable";
import ImportarEstudiantes from "@/components/estudiantes/ImportarEstudiantes";

export default function EstudiantesPage() {
  const [refresh, setRefresh] = useState(0);

  function actualizarTabla() {
    setRefresh((valor) => valor + 1);
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-6">Estudiantes</h2>

      <ImportarEstudiantes onImportado={actualizarTabla} />

      <EstudianteForm onGuardado={actualizarTabla} />

      <div className="mt-8">
        <EstudianteTable refresh={refresh} />
      </div>
    </>
  );
}