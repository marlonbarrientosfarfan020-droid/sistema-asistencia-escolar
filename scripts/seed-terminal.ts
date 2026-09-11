import "dotenv/config";
import { prisma } from "../lib/prisma";
import { hashTerminalToken } from "../lib/terminal-auth";

async function main() {
  console.log("=== REGISTRANDO TERMINAL PORTERÍA OFICIAL V1.0 ===");

  const terminalId = "TRM-CASIA-01";
  const tokenPlano = "sec_trm_santarita_2026_9f8d7c6b5a4e3f21";
  const tokenHash = hashTerminalToken(tokenPlano);
  const colegioId = "SANTA_RITA_001";
  const nombre = "Terminal Portería Principal - Santa Rita";

  // Verificar si el colegio existe
  const colegio = await prisma.colegio.findUnique({
    where: { codigo: colegioId },
  });

  if (!colegio) {
    console.error(`Colegio ${colegioId} no encontrado en la base de datos.`);
    return;
  }

  const terminalExistente = await prisma.terminal.findUnique({
    where: { terminalId },
  });

  if (terminalExistente) {
    const actualizada = await prisma.terminal.update({
      where: { terminalId },
      data: {
        nombre,
        colegioId,
        tokenHash,
        estado: "ACTIVA",
      },
    });
    console.log("✅ Terminal existente actualizada exitosamente:", actualizada.terminalId);
  } else {
    const creada = await prisma.terminal.create({
      data: {
        terminalId,
        nombre,
        colegioId,
        tokenHash,
        estado: "ACTIVA",
      },
    });
    console.log("✅ Terminal creada exitosamente en base de datos:", creada.terminalId);
  }

  console.log("==================================================");
  console.log("CREDENTIALES REGISTRADAS:");
  console.log("Terminal ID:", terminalId);
  console.log("Token:", tokenPlano);
  console.log("Token Hash (SHA-256):", tokenHash);
  console.log("Estado: ACTIVA");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Error en seed de terminal:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
