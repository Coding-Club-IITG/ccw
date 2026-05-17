export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  moduleRoles: { module: string; role?: string }[];
  canUpload: boolean;
  isGlobalAdmin: boolean;
  isAdmin: boolean;
  headModules: string[];
}

export interface AccessControl {
  allMembers: boolean;
  allowedModules: string[];
  allowedGlobalRoles: string[];
  allowedModuleRoles: string[];
  allowedUsers: string[];
}

export interface FileEntry {
  _id: string;
  title: string;
  description: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: string;
  uploadedBy: string;
  uploadedByName: string;
  uploaderModule: string | null;
  isDownloadable: boolean;
  accessControl: AccessControl;
  createdAt: string;
}

export interface UserBasic {
  _id: string;
  name: string;
  email: string;
}
