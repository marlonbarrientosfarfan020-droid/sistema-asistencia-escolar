import ProteccionRol from "@/components/auth/ProteccionRol";

export default function SalidasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProteccionRol
      rolesPermitidos={[
        "ADMIN",
        "DIRECTIVO",
        "PERSONAL",
        "DEMO",
      ]}
    >
      {children}
    </ProteccionRol>
  );
}
