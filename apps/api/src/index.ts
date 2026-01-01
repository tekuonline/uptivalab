import { createServer } from "./server.js";
import { appConfig } from "./config.js";
import { monitorOrchestrator } from "./services/monitor-engine/orchestrator.js";
import { maintenanceScheduler } from "./services/maintenance/scheduler.js";

const start = async () => {
  const server = await createServer();
  try {
    // Bootstrap monitors and maintenance scheduler with error handling
    try {
      await monitorOrchestrator.bootstrap();
      console.log("✅ Monitor orchestrator bootstrapped successfully");
    } catch (error) {
      console.error("❌ Failed to bootstrap monitor orchestrator:", error);
      // Don't crash the server if bootstrap fails
    }

    try {
      await maintenanceScheduler.bootstrap();
      console.log("✅ Maintenance scheduler bootstrapped successfully");
    } catch (error) {
      console.error("❌ Failed to bootstrap maintenance scheduler:", error);
      // Don't crash the server if bootstrap fails
    }

    await server.listen({ port: appConfig.PORT, host: "0.0.0.0" });
    server.log.info(`UptivaLab API listening on ${appConfig.PORT}`);
  } catch (error) {
    server.log.error(error, "Failed to start API server");
    process.exit(1);
  }
};

start();
