import { createClient } from "redis";
import { logger } from "@/lib/utils";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));

if (!redisClient.isOpen) {
  redisClient.connect();
}

export default redisClient;
