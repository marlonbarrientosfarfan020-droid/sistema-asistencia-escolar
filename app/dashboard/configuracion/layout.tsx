"use client";

import ProteccionRol from "@/components/auth/ProteccionRol";

export default function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProteccionRol
  rolesPermitidos={[
    "ADMIN",
    "DIRECTIVO",
  ]}
>
      {children}
    </ProteccionRol>
  );
}