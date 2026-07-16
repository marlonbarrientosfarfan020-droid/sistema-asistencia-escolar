"use client";

import ProteccionRol from "@/components/auth/ProteccionRol";

export default function EstudiantesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProteccionRol
      rolesPermitidos={[
        "ADMIN",
        "DIRECTIVO",
        "DEMO",
        "PERSONAL",
      ]}
    >
      {children}
    </ProteccionRol>
  );
}