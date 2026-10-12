"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * MÓDULO AUDITORÍA RETIRADO DE LA INTERFAZ VISUAL
 *
 * La auditoría se mantiene 100% activa a nivel interno en PostgreSQL y APIs,
 * pero ya no existe como módulo navegable visual del dashboard.
 */
export default function AuditoriaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/acceso-denegado");
  }, [router]);

  return null;
}
