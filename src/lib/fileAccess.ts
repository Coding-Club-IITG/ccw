/**
 * File Access Control utilities
 *
 * Permission tiers (in order of privilege):
 *  1. Global File Admins (Secretary / OC) — full control over every file.
 *  2. Club Admins (+ Core Team)           — can upload; manage their own uploads
 *                                            and files in modules where they are Head.
 *  3. Module Heads                         — can upload; manage files whose
 *                                            uploaderModule matches one of their modules.
 *  4. Standard members                     — read-only, subject to per-file ACL.
 */

import { IFileEntry } from "@/models/FileEntry";
import {
  ParsedModuleRole,
  isAdmin,
  isGlobalAdmin,
  isModuleHead,
  getHeadModules,
} from "@/lib/roles";

// Shared types

// Minimal user shape
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  moduleRoles?: any;
}

// Upload permission
export function canUploadFiles(
  role: string,
  moduleRoles: ParsedModuleRole[],
): boolean {
  return isAdmin(role) || isModuleHead(moduleRoles);
}

// Management permission
export function canManageFile(
  userId: string,
  role: string,
  moduleRoles: ParsedModuleRole[],
  file: Pick<IFileEntry, "uploadedBy" | "uploaderModule">,
): boolean {
  if (isGlobalAdmin(role)) return true;

  const headModules = getHeadModules(moduleRoles);

  // Module heads
  if (
    headModules.length > 0 &&
    file.uploaderModule &&
    headModules.includes(file.uploaderModule)
  ) {
    return true;
  }

  // Anyone who can upload can always manage their own uploads
  if (file.uploadedBy.toString() === userId) return true;

  return false;
}

// View / download permission

/**
 * Access is granted if any ONE of these conditions is satisfied:
 *  • The user can manage the file.
 *  • accessControl.allMembers is true.
 *  • The user's global role is in accessControl.allowedGlobalRoles.
 *  • Any of the user's modules is in accessControl.allowedModules.
 *  • Any of the user's module roles is in accessControl.allowedModuleRoles.
 *  • The user's ID is in accessControl.allowedUsers.
 */
export function canAccessFile(
  userId: string,
  role: string,
  moduleRoles: ParsedModuleRole[],
  file: IFileEntry,
): boolean {
  if (canManageFile(userId, role, moduleRoles, file)) return true;

  const acl = file.accessControl;

  if (acl.allMembers) return true;
  if (acl.allowedGlobalRoles.includes(role)) return true;

  const userModules = moduleRoles.map((mr) => mr.module);
  if (acl.allowedModules.some((m) => userModules.includes(m))) return true;

  const userModuleRoleValues = moduleRoles.map((mr) => mr.role);
  if (acl.allowedModuleRoles.some((r) => userModuleRoleValues.includes(r)))
    return true;

  if (acl.allowedUsers.some((uid) => uid.toString() === userId)) return true;

  return false;
}
