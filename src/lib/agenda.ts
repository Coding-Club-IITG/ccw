import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import { RedisNotificationChannel } from "@agendajs/redis-backend";
import { logger } from "./utils";

const mongodbUri = process.env.MONGODB_URI!;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const agenda = new Agenda({
  backend: new MongoBackend({
    address: mongodbUri,
    collection: "agenda_jobs",
  }),
  notificationChannel: new RedisNotificationChannel({
    connectionString: redisUrl,
  }),
  processEvery: "1 minute",
  maxConcurrency: 4,
  defaultLockLifetime: 10 * 60 * 1000,
});

agenda.on("error", (err) => {
  logger.error("[Agenda] Internal error:", err);
});

agenda.on("ready", () => {
  logger.info("[Agenda] Connected and Ready");
});

export default agenda;
