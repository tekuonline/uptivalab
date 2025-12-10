import { createServer } from "./server.js";
import { appConfig } from "./config.js";
import { monitorOrchestrator } from "./services/monitor-engine/orchestrator.js";

const start = async () => {
  const server = await createServer();
  try {
  await monitorOrchestrator.bootstrap();
  await server.listen({ port: appConfig.PORT, host: "0.0.0.0" });
    server.log.info(`UptivaLab API listening on ${appConfig.PORT}`);
  } catch (error) {
    server.log.error(error, "Failed to start API server");
    process.exit(1);
  }
};

start();
