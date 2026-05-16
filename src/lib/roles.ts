/**
 * Role checking and parsing utilities
 */

export interface ParsedModuleRole {
  module: string;
  role?: string;
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

// Global administrators
export function isGlobalAdmin(role?: string): boolean {
  return role === "Secretary" || role === "OC";
}

// Checks if a user has an administrative role
export function isAdmin(role?: string): boolean {
  return role === "Secretary" || role === "OC" || role === "Head";
}

// Checks if a user can set POTD problems
export function canSetPOTD(role?: string): boolean {
  return isAdmin(role) || role === "Core Team";
}

// Module Heads
export function isModuleHead(role?: string): boolean {
  return role === "Head";
}

// List of modules for which user is Head
export function getHeadModules(
  role?: string,
  moduleRoles?: ParsedModuleRole[],
): string[] {
  if (role !== "Head" || !moduleRoles) return [];
  return moduleRoles.map((mr) => mr.module);
}

// Enforces role constraints
export function cleanUserRoles(role: string, moduleRoles: any[]): any[] {
  if (role === "Secretary" || role === "OC") {
    return []; // Cannot have module roles
  }
  if (role === "Head") {
    // Heads can only have module, not specific role
    return moduleRoles.map((mr) => ({ module: mr.module }));
  }
  return moduleRoles;
}
