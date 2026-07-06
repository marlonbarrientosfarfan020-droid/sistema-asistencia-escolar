import { prisma } from "@/lib/prisma";

export async function registrarAuditoria({
  usuario,
  rol,
  accion,
  modulo,
  detalle,
}: {
  usuario: string;
  rol: string;
  accion: string;
  modulo: string;
  detalle: string;
}) {
  try {
    await prisma.auditoria.create({
      data: {
        usuario,
        rol,
        accion,
        modulo,
        detalle,
      },
    });
  } catch (error) {
    console.error("Error registrando auditoría:", error);
  }
}