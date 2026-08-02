import cron from "node-cron";
import { revisarAusentes } from "@/services/alertaService";

let iniciado = false;

export function iniciarSchedulerLocal() {
  if (iniciado) return;

  iniciado = true;

  console.log("🚨 Scheduler local de alertas iniciado...");

  cron.schedule("* * * * *", async () => {
    try {
      console.log("🔎 Revisando alertas de ausentes...");

      const resultado = await revisarAusentes();

      console.log(
  `✅ ${resultado.message} | Estudiantes: ${resultado.resumen.totalEstudiantes} | Iniciales: ${resultado.resumen.alertasInicialesEnviadas} | Tardanzas: ${resultado.resumen.alertasTardanzaEnviadas} | Ausencias: ${resultado.resumen.ausenciasConfirmadasEnviadas} | Errores: ${resultado.resumen.erroresEnvio}`
);
    } catch (error) {
      console.error("❌ Error en scheduler local:", error);
    }
  });
}