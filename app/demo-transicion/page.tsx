"use client";

import LoginTransition3D from "@/components/LoginTransition3D";

export default function DemoTransicionPage() {
  return (
    <LoginTransition3D
      usuario="Dulio Jacinto"
      tipoUsuario="FAMILIA / APODERADO"
      nombreEstudiante="Familia de Jacinto"
      rutaDestino="/login"
      duracionSegundos={30}
    />
  );
}
