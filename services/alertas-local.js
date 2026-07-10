require("ts-node/register");
require("tsconfig-paths/register");

const { iniciarSchedulerLocal } = require("../services/localScheduler");

iniciarSchedulerLocal();

console.log("⏳ Proceso de alertas activo. No cierres esta terminal.");