import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createAnalysisWorker } from "./queue/analysis.worker.js";

const app = createApp();
const worker = createAnalysisWorker();

const server = app.listen(env.port, env.host, () => {
  console.log(`Backend listening on ${env.host}:${env.port} (AI_PROVIDER=${env.aiProvider})`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close();
  worker.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
