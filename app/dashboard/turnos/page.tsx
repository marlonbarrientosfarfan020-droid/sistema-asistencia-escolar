"use client";

import { useState } from "react";
import TurnoForm from "../../../components/turnos/TurnoForm";
import TurnoTable from "../../../components/turnos/TurnoTable";

export default function TurnosPage() {
  const [refresh, setRefresh] = useState(0);

  function actualizarTabla() {
    setRefresh((r) => r + 1);
  }

  return (
    <>
      <h2 className="text-4xl font-bold mb-6">
        Configuración de Turnos
      </h2>

      <TurnoForm onGuardado={actualizarTabla} />

      <div className="mt-8">
        <TurnoTable refresh={refresh} />
      </div>
    </>
  );
}