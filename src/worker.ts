import "./lib/env";
import agenda from "./lib/agenda";
import { syncCodeforcesRatings } from "./lib/jobs/cfSync";
import { logger } from "./lib/utils";
import dbConnect from "./lib/mongodb";

async function run() {
  logger.info("[Worker] Starting standalone background worker...");

  // Ensure DB is connected
  await dbConnect();

  // Define jobs
  agenda.define("sync-cf-ratings", async () => {
    await syncCodeforcesRatings();
  });

  // Start agenda
  await agenda.start();

  // Schedule the job to run every 24 hours
  await agenda.every("24 hours", "sync-cf-ratings");

  logger.info("[Worker] Agenda started and jobs scheduled.");

  // Graceful shutdown
  async function graceful() {
    logger.info("[Worker] Stopping agenda...");
    await agenda.stop();
    process.exit(0);
  }

  process.on("SIGTERM", graceful);
  process.on("SIGINT", graceful);
}

run().catch((err) => {
  logger.error("[Worker] Fatal error during startup:", err);
  process.exit(1);
});
