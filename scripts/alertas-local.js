console.log("🚨 Scheduler local de alertas iniciado...");
console.log("⏳ No cierres esta terminal.");

async function revisarAusentes() {
  try {
    console.log("🔎 Revisando alertas de ausentes...");

    const res = await fetch("http://localhost:3000/api/alertas/ausentes");
    const data = await res.json();

    console.log(
      `✅ ${data.message} | Alertas enviadas: ${data.alertasEnviadas}`
    );
  } catch (error) {
    console.error("❌ Error revisando ausentes:", error.message);
  }
}

// Ejecuta al iniciar
revisarAusentes();

// Ejecuta cada minuto
setInterval(revisarAusentes, 60 * 1000);