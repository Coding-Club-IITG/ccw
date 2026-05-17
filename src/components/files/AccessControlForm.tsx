"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, FolderOpen, Shield, Users, Search, X } from "lucide-react";
import { MODULES, GLOBAL_ROLES, MODULE_ROLES } from "@/lib/constants";
import type { AccessControl, UserBasic } from "./types";
import styles from "./FilesClient.module.scss";

interface Props {
  value: AccessControl;
  onChange: (acl: AccessControl) => void;
  users: UserBasic[];
}

export default function AccessControlForm({ value, onChange, users }: Props) {
  const [userSearch, setUserSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleArr<T extends string>(
    arr: T[],
    item: T,
    key: keyof AccessControl,
  ) {
    const next = arr.includes(item)
      ? arr.filter((x) => x !== item)
      : [...arr, item];
    onChange({ ...value, [key]: next });
  }

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

            <div className={styles.userPickerWrapper} ref={pickerRef}>
              <div className={styles.userSearchInput}>
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
              </div>
              {showDropdown && userSearch && filteredUsers.length > 0 && (
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
                        setShowDropdown(false);
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
