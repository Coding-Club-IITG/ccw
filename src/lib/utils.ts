import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging tailwind classes and handling conditional classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date to a readable string.
 */
export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Shared logger that only outputs in development environment.
 */
const createLogger = (level: "log" | "warn" | "error" | "debug") => {
  return (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console[level]("[CCW]", ...args);
    }
  };
};

export const logger = {
  info: createLogger("log"),
  warn: createLogger("warn"),
  error: createLogger("error"),
  debug: createLogger("debug"),
};

/**
 * Checks if a user has an administrative role.
 */
export function isAdmin(role?: string): boolean {
  return role === "Secretary" || role === "OC" || role === "Core Team";
}
