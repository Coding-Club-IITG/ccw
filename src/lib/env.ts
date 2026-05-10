import * as dotenv from "dotenv";
import path from "path";

/**
 * Loads environment variables from .env.local and .env files.
 * This should be imported as early as possible in entry points.
 */
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
