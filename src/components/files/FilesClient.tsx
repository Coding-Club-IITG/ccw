"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Trash2,
  Edit2,
  Eye,
  Download,
  X,
  Search,
  FileIcon,
  FolderOpen,
  Shield,
  Users,
  Globe,
  AlertCircle,
} from "lucide-react";
import styles from "./FilesClient.module.scss";
import { MODULES, GLOBAL_ROLES, MODULE_ROLES } from "@/lib/constants";

// Types

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  moduleRoles: { module: string; role?: string }[];
  canUpload: boolean;
  isGlobalAdmin: boolean;
  isAdmin: boolean;
  headModules: string[]; // Modules for which user is a Head
}

interface AccessControl {
  allMembers: boolean;
  allowedModules: string[];
  allowedGlobalRoles: string[];
  allowedModuleRoles: string[];
  allowedUsers: string[];
}

interface FileEntry {
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

interface UserBasic {
  _id: string;
  name: string;
  email: string;
}

// Constants

const EMPTY_ACL: AccessControl = {
  allMembers: false,
  allowedModules: [],
  allowedGlobalRoles: [],
  allowedModuleRoles: [],
  allowedUsers: [],
};

const DEFAULT_FOLDER = "General";

// Local helpers

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Mirror of server-side canManageFile (avoids re-fetching for UI hints)
function canManageFile(user: CurrentUser, file: FileEntry): boolean {
  if (user.isGlobalAdmin) return true;
  if (user.headModules.length > 0 && file.uploaderModule) {
    if (user.headModules.includes(file.uploaderModule)) return true;
  }
  if (file.uploadedBy === user.id) return true;
  return false;
}

function aclSummary(acl: AccessControl): string {
  if (acl.allMembers) return "All Members";
  const parts: string[] = [];
  if (acl.allowedModules.length)
    parts.push(`${acl.allowedModules.length} module(s)`);
  if (acl.allowedGlobalRoles.length)
    parts.push(`${acl.allowedGlobalRoles.length} role(s)`);
  if (acl.allowedModuleRoles.length)
    parts.push(`${acl.allowedModuleRoles.length} module role(s)`);
  if (acl.allowedUsers.length) parts.push(`${acl.allowedUsers.length} user(s)`);
  return parts.length ? parts.join(", ") : "Restricted";
}

// AccessControl form

interface ACLFormProps {
  value: AccessControl;
  onChange: (acl: AccessControl) => void;
  users: UserBasic[];
}

function AccessControlForm({ value, onChange, users }: ACLFormProps) {
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userPickerRef.current &&
        !userPickerRef.current.contains(e.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleArr = <T extends string>(
    arr: T[],
    item: T,
    key: keyof AccessControl,
  ) => {
    const next = arr.includes(item)
      ? arr.filter((x) => x !== item)
      : [...arr, item];
    onChange({ ...value, [key]: next });
  };

  const filteredUsers = users.filter(
    (u) =>
      !value.allowedUsers.includes(u._id) &&
      (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())),
  );

  const selectedUsers = users.filter((u) => value.allowedUsers.includes(u._id));

  return (
    <div className={styles.aclForm}>
      {/* All Members */}
      <label className={styles.aclCheckRow}>
        <input
          type="checkbox"
          checked={value.allMembers}
          onChange={(e) => onChange({ ...value, allMembers: e.target.checked })}
        />
        <Globe size={14} />
        <strong>All club members can access this file</strong>
      </label>

      {!value.allMembers && (
        <>
          {/* Modules */}
          <div className={styles.aclGroup}>
            <div className={styles.aclGroupLabel}>
              <FolderOpen size={13} /> Allow by module
            </div>
            <div className={styles.checkGrid}>
              {MODULES.map((m) => (
                <label key={m} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={value.allowedModules.includes(m)}
                    onChange={() =>
                      toggleArr(value.allowedModules, m, "allowedModules")
                    }
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>

          {/* Global Roles */}
          <div className={styles.aclGroup}>
            <div className={styles.aclGroupLabel}>
              <Shield size={13} /> Allow by global role
            </div>
            <div className={styles.checkGrid}>
              {GLOBAL_ROLES.map((r) => (
                <label key={r} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={value.allowedGlobalRoles.includes(r)}
                    onChange={() =>
                      toggleArr(
                        value.allowedGlobalRoles,
                        r,
                        "allowedGlobalRoles",
                      )
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {/* Module Roles */}
          <div className={styles.aclGroup}>
            <div className={styles.aclGroupLabel}>
              <Users size={13} /> Allow by module role
            </div>
            <div className={styles.checkGrid}>
              {MODULE_ROLES.map((r) => (
                <label key={r} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={value.allowedModuleRoles.includes(r)}
                    onChange={() =>
                      toggleArr(
                        value.allowedModuleRoles,
                        r,
                        "allowedModuleRoles",
                      )
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {/* Specific Users */}
          <div className={styles.aclGroup}>
            <div className={styles.aclGroupLabel}>
              <Users size={13} /> Allow specific users
            </div>

            {/* Selected user tags */}
            {selectedUsers.length > 0 && (
              <div className={styles.userTags}>
                {selectedUsers.map((u) => (
                  <span key={u._id} className={styles.userTag}>
                    {u.name}
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...value,
                          allowedUsers: value.allowedUsers.filter(
                            (id) => id !== u._id,
                          ),
                        })
                      }
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search / add users */}
            <div className={styles.userPickerWrapper} ref={userPickerRef}>
              <div className={styles.userSearchInput}>
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                />
              </div>
              {showUserDropdown && userSearch && filteredUsers.length > 0 && (
                <div className={styles.userDropdown}>
                  {filteredUsers.slice(0, 8).map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      className={styles.userDropdownItem}
                      onClick={() => {
                        onChange({
                          ...value,
                          allowedUsers: [...value.allowedUsers, u._id],
                        });
                        setUserSearch("");
                        setShowUserDropdown(false);
                      }}
                    >
                      <strong>{u.name}</strong>
                      <span>{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Main Component

interface FilesClientProps {
  currentUser: CurrentUser;
}

export default function FilesClient({ currentUser }: FilesClientProps) {
  // Data state
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("__all__");

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    title: "",
    description: "",
    folder: DEFAULT_FOLDER,
    uploaderModule: currentUser.headModules[0] ?? "",
    isDownloadable: true,
    accessControl: { ...EMPTY_ACL },
  });

  // Edit modal state
  const [editFile, setEditFile] = useState<FileEntry | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    folder: "",
    isDownloadable: true,
    accessControl: { ...EMPTY_ACL },
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch files

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Failed to load files.");
      const data = await res.json();
      setFiles(data.files);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!currentUser.canUpload) return;
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {}
  }, [currentUser.canUpload]);

  useEffect(() => {
    fetchFiles();
    fetchUsers();
  }, [fetchFiles, fetchUsers]);

  // Derived data

  const folders = [
    "__all__",
    ...Array.from(new Set(files.map((f) => f.folder))).sort(),
  ];

  const filteredFiles = files.filter((f) => {
    const matchesFolder =
      selectedFolder === "__all__" || f.folder === selectedFolder;
    const matchesSearch =
      !searchQuery ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.uploadedByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.folder.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  // Upload handlers

  function openUploadModal() {
    setUploadForm({
      file: null,
      title: "",
      description: "",
      folder: DEFAULT_FOLDER,
      uploaderModule: currentUser.headModules[0] ?? "",
      isDownloadable: true,
      accessControl: { ...EMPTY_ACL },
    });
    setUploadError(null);
    setShowUploadModal(true);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadForm((prev) => ({
      ...prev,
      file,
      // Auto-fill title from filename (without extension)
      title: prev.title || (file ? file.name.replace(/\.[^/.]+$/, "") : ""),
    }));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.file) {
      setUploadError("Please select a file.");
      return;
    }
    if (!uploadForm.title.trim()) {
      setUploadError("Title is required.");
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", uploadForm.file);
    fd.append("title", uploadForm.title.trim());
    fd.append("description", uploadForm.description.trim());
    fd.append("folder", uploadForm.folder.trim() || DEFAULT_FOLDER);
    fd.append("isDownloadable", String(uploadForm.isDownloadable));
    fd.append("uploaderModule", uploadForm.uploaderModule || "null");
    fd.append("accessControl", JSON.stringify(uploadForm.accessControl));

    try {
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setShowUploadModal(false);
      fetchFiles();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  // Edit handlers

  function openEditModal(file: FileEntry) {
    setEditFile(file);
    setEditForm({
      title: file.title,
      description: file.description,
      folder: file.folder,
      isDownloadable: file.isDownloadable,
      accessControl: { ...EMPTY_ACL, ...file.accessControl },
    });
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFile) return;
    if (!editForm.title.trim()) {
      setEditError("Title is required.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/files/${editFile._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setEditFile(null);
      fetchFiles();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  // Delete handler

  async function handleDelete(file: FileEntry) {
    if (
      !confirm(
        `Delete "${file.title}"?\n\nThis will permanently remove the file from the server.`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/files/${file._id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Delete failed.");
        return;
      }
      fetchFiles();
    } catch {
      alert("Network error. Please try again.");
    }
  }

  // Render

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Internal Files</h1>
          <p>Shared resources, documentation, and module-specific files.</p>
        </div>
        {currentUser.canUpload && (
          <button className={styles.uploadBtn} onClick={openUploadModal}>
            <Upload size={15} />
            Upload File
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search files…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className={styles.folderTabs}>
          {folders.map((folder) => (
            <button
              key={folder}
              className={`${styles.folderTab} ${selectedFolder === folder ? styles.active : ""}`}
              onClick={() => setSelectedFolder(folder)}
            >
              {folder === "__all__" ? "All Files" : folder}
              <span className={styles.folderCount}>
                {folder === "__all__"
                  ? files.length
                  : files.filter((f) => f.folder === folder).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* File Table */}
      {loading ? (
        <div className={styles.emptyState}>Loading files…</div>
      ) : error ? (
        <div className={styles.errorState}>
          <AlertCircle size={18} />
          {error}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className={styles.emptyState}>
          {searchQuery
            ? `No files matching "${searchQuery}".`
            : "No files here yet."}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Folder</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Size</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => {
                const canManage = canManageFile(currentUser, file);
                return (
                  <tr key={file._id}>
                    <td>
                      <div className={styles.fileTitle}>
                        <FileIcon size={15} className={styles.fileIcon} />
                        <div>
                          <span className={styles.fileName}>{file.title}</span>
                          {file.description && (
                            <span className={styles.fileDesc}>
                              {file.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.folderBadge}>{file.folder}</span>
                    </td>
                    <td className={styles.subtle}>{file.uploadedByName}</td>
                    <td className={styles.subtle}>
                      {formatDate(file.createdAt)}
                    </td>
                    <td className={styles.subtle}>{formatBytes(file.size)}</td>
                    <td>
                      <span
                        className={`${styles.accessBadge} ${file.isDownloadable ? styles.download : styles.viewOnly}`}
                      >
                        {file.isDownloadable ? (
                          <>
                            <Download size={11} /> Download
                          </>
                        ) : (
                          <>
                            <Eye size={11} /> View only
                          </>
                        )}
                      </span>
                      <div className={styles.aclHint}>
                        {aclSummary(file.accessControl)}
                      </div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {/* View / Download */}
                        <a
                          href={`/api/files/${file._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.actionBtn}
                          title={
                            file.isDownloadable ? "Download file" : "View file"
                          }
                        >
                          {file.isDownloadable ? (
                            <Download size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                        </a>

                        {canManage && (
                          <>
                            <button
                              className={styles.actionBtn}
                              title="Edit permissions"
                              onClick={() => openEditModal(file)}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.danger}`}
                              title="Delete file"
                              onClick={() => handleDelete(file)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div
            className={styles.overlay}
            onClick={() => !uploadLoading && setShowUploadModal(false)}
          />
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Upload File</h2>
                <p>Fill in the details and set access permissions.</p>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowUploadModal(false)}
                disabled={uploadLoading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpload} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* File input */}
                <div className={styles.field}>
                  <label>File *</label>
                  <div
                    className={styles.fileDropZone}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadForm.file ? (
                      <div className={styles.fileSelected}>
                        <FileIcon size={16} />
                        <span>{uploadForm.file.name}</span>
                        <span className={styles.subtle}>
                          ({formatBytes(uploadForm.file.size)})
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>Click to select a file</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Title */}
                <div className={styles.field}>
                  <label>Title *</label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Q3 Meeting Notes"
                    required
                  />
                </div>

                {/* Description */}
                <div className={styles.field}>
                  <label>Description</label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of this file…"
                    rows={2}
                  />
                </div>

                {/* Row: folder + module */}
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Folder</label>
                    <input
                      type="text"
                      list="existing-folders"
                      value={uploadForm.folder}
                      onChange={(e) =>
                        setUploadForm((p) => ({ ...p, folder: e.target.value }))
                      }
                      placeholder="General"
                    />
                    <datalist id="existing-folders">
                      {Array.from(new Set(files.map((f) => f.folder))).map(
                        (f) => (
                          <option key={f} value={f} />
                        ),
                      )}
                    </datalist>
                    <span className={styles.hint}>
                      Type or pick an existing folder
                    </span>
                  </div>

                  {/* Module context (only shown when user is head or admin) */}
                  {(currentUser.isAdmin ||
                    currentUser.headModules.length > 1) && (
                    <div className={styles.field}>
                      <label>Module context</label>
                      <select
                        value={uploadForm.uploaderModule}
                        onChange={(e) =>
                          setUploadForm((p) => ({
                            ...p,
                            uploaderModule: e.target.value,
                          }))
                        }
                      >
                        {currentUser.isAdmin && (
                          <option value="">None (Admin upload)</option>
                        )}
                        {(currentUser.isAdmin
                          ? MODULES
                          : currentUser.headModules
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <span className={styles.hint}>
                        Used for module head management
                      </span>
                    </div>
                  )}
                </div>

                {/* Downloadable toggle */}
                <div className={styles.field}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={uploadForm.isDownloadable}
                      onChange={(e) =>
                        setUploadForm((p) => ({
                          ...p,
                          isDownloadable: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow downloading</span>
                    <span className={styles.toggleHint}>
                      {uploadForm.isDownloadable
                        ? "Users can download this file"
                        : "View-only — no download option"}
                    </span>
                  </label>
                </div>

                {/* Access Control */}
                <div className={styles.aclSection}>
                  <div className={styles.aclSectionHeader}>
                    <Shield size={14} />
                    <strong>Access Permissions</strong>
                  </div>
                  <AccessControlForm
                    value={uploadForm.accessControl}
                    onChange={(acl) =>
                      setUploadForm((p) => ({ ...p, accessControl: acl }))
                    }
                    users={users}
                  />
                </div>

                {uploadError && (
                  <div className={styles.formError}>
                    <AlertCircle size={14} />
                    {uploadError}
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploadLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={uploadLoading}
                >
                  <Upload size={14} />
                  {uploadLoading ? "Uploading…" : "Upload File"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Edit Permissions Modal */}
      {editFile && (
        <>
          <div
            className={styles.overlay}
            onClick={() => !editLoading && setEditFile(null)}
          />
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Edit File</h2>
                <p className={styles.subtle}>{editFile.originalName}</p>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setEditFile(null)}
                disabled={editLoading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEdit} className={styles.modalForm}>
              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label>Title *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, title: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    rows={2}
                  />
                </div>

                <div className={styles.field}>
                  <label>Folder</label>
                  <input
                    type="text"
                    list="existing-folders-edit"
                    value={editForm.folder}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, folder: e.target.value }))
                    }
                  />
                  <datalist id="existing-folders-edit">
                    {Array.from(new Set(files.map((f) => f.folder))).map(
                      (f) => (
                        <option key={f} value={f} />
                      ),
                    )}
                  </datalist>
                </div>

                <div className={styles.field}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={editForm.isDownloadable}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          isDownloadable: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow downloading</span>
                    <span className={styles.toggleHint}>
                      {editForm.isDownloadable
                        ? "Users can download this file"
                        : "View-only — no download option"}
                    </span>
                  </label>
                </div>

                <div className={styles.aclSection}>
                  <div className={styles.aclSectionHeader}>
                    <Shield size={14} />
                    <strong>Access Permissions</strong>
                  </div>
                  <AccessControlForm
                    value={editForm.accessControl}
                    onChange={(acl) =>
                      setEditForm((p) => ({ ...p, accessControl: acl }))
                    }
                    users={users}
                  />
                </div>

                {editError && (
                  <div className={styles.formError}>
                    <AlertCircle size={14} />
                    {editError}
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditFile(null)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={editLoading}
                >
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
