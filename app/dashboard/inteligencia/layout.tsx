"use client";

import ProteccionRol from "@/components/auth/ProteccionRol";

export default function InteligenciaLayout({
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
      ]}
    >
      {children}
    </ProteccionRol>
  );
}