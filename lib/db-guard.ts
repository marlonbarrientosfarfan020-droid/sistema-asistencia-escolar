/**
 * lib/db-guard.ts
 * Salvaguarda de Seguridad Operativa y Separación Estricta de Entornos.
 * Impide que scripts de pruebas, seeds, migraciones locales o comandos destructivos
 * se ejecuten por accidente contra la base de datos de producción (Neon).
 */

export function esBaseDeProduccion(url?: string): boolean {
  const dbUrl = url || process.env.DATABASE_URL || "";
  return (
    dbUrl.includes("neon.tech") ||
    dbUrl.includes("pooler") ||
    dbUrl.includes("ep-cool-rice") ||
    dbUrl.includes("aws.neon")
  );
}

export function validarEntornoSeguro(accion: string = "operación de prueba / seed"): void {
  const dbUrl = process.env.DATABASE_URL || "";

  if (esBaseDeProduccion(dbUrl)) {
    const override = process.env.ALLOW_PRODUCTION_WRITE;
    if (override !== "CONFIRM_PRODUCTION_WRITE") {
      const errorMsg = [
        "================================================================================",
        "⛔ [BLOQUEO DE SEGURIDAD CRÍTICO - PROTECCIÓN DE PRODUCCIÓN]",
        `Se intentó ejecutar: "${accion}"`,
        "El entorno actual está configurado hacia la base de datos de PRODUCCIÓN (Neon).",
        "Por seguridad institucional, todas las pruebas, seeds y simulaciones deben",
        "ejecutarse exclusivamente contra PostgreSQL local (localhost).",
        "OPERACIÓN ABORTADA INMEDIATAMENTE PARA PROTEGER LOS DATOS ESCOLARES.",
        "================================================================================",
      ].join("\n");

      console.error(errorMsg);
      throw new Error(`[BLOQUEO DE SEGURIDAD] Intento de ejecutar "${accion}" contra producción Neon.`);
    }
  }
}
