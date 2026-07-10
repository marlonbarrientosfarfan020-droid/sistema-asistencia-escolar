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
        `✅ ${resultado.message} | Alertas enviadas: ${resultado.alertasEnviadas}`
      );
    } catch (error) {
      console.error("❌ Error en scheduler local:", error);
    }
  });
}