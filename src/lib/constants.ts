/**
 * Shared constants
 */

export const MODULES = [
  "Software Development",
  "Competitive Programming",
  "Machine Learning",
  "Cybersecurity",
  "Design",
] as const;

export type ModuleName = (typeof MODULES)[number];

export const PROJECT_MODULES = [...MODULES, "General"] as const;
export type ProjectModuleName = (typeof PROJECT_MODULES)[number];

export const GLOBAL_ROLES = ["Secretary", "OC", "Core Team", "Member"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const MODULE_ROLES = [
  "Head",
  "Senior Coordinator",
  "Coordinator",
  "Member",
] as const;
export type ModuleRoleType = (typeof MODULE_ROLES)[number];

export const PROJECT_STATUSES = ["Upcoming", "Completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
