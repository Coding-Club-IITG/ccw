/**
 * Role checking and parsing utilities
 */

export interface ParsedModuleRole {
  module: string;
  role: string;
}

// Handles both raw array and stringified form
export function parseModuleRoles(raw: any): ParsedModuleRole[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Checks if a user has an administrative role
export function isAdmin(role?: string): boolean {
  return role === "Secretary" || role === "OC" || role === "Core Team";
}

// Global administrators
export function isGlobalAdmin(role?: string): boolean {
  return role === "Secretary" || role === "OC";
}

// Module Heads
export function isModuleHead(moduleRoles: ParsedModuleRole[]): boolean {
  return moduleRoles.some((mr) => mr.role === "Head");
}

// List of modules for which user is Head
export function getHeadModules(moduleRoles: ParsedModuleRole[]): string[] {
  return moduleRoles.filter((mr) => mr.role === "Head").map((mr) => mr.module);
}
