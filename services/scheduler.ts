import cron from "node-cron";

console.log("⏰ Scheduler iniciado...");

// Se ejecuta cada minuto
cron.schedule("* * * * *", async () => {
  try {
    console.log("⏰ Revisando si toca enviar reporte...");

    await fetch("http://localhost:3000/api/reportes/automatico");
  } catch (error) {
    console.error("Error Scheduler:", error);
  }
});