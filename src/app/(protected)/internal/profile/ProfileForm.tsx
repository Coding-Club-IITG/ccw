"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { updateProfile } from "@/lib/actions/user";
import styles from "./ProfileForm.module.scss";

export default function ProfileForm() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    codeforcesId: session?.user?.codeforcesId || "",
    githubId: session?.user?.githubId || "",
    bio: session?.user?.bio || "",
    phoneNumber: session?.user?.phoneNumber || "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await updateProfile(formData);

      // Update the local session with new data
      await update({
        name: formData.name,
        codeforcesId: formData.codeforcesId,
        githubId: formData.githubId,
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
      });

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update profile.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Your Profile</h1>
      <p className={styles.subtitle}>
        Update your personal details and platform IDs.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={session?.user?.email || ""}
            disabled
            style={{ background: "#f5f5f5", color: "#666" }}
          />
          <span className={styles.hint}>Email cannot be changed.</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="name">Display Name</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter your full name"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="codeforces">Codeforces ID</label>
          <input
            type="text"
            id="codeforces"
            value={formData.codeforcesId}
            onChange={(e) =>
              setFormData({ ...formData, codeforcesId: e.target.value })
            }
            placeholder="e.g. tourist"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="github">GitHub Username</label>
          <input
            type="text"
            id="github"
            value={formData.githubId}
            onChange={(e) =>
              setFormData({ ...formData, githubId: e.target.value })
            }
            placeholder="e.g. octocat"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="phone">Phone Number</label>
          <input
            type="text"
            id="phone"
            value={formData.phoneNumber}
            onChange={(e) =>
              setFormData({ ...formData, phoneNumber: e.target.value })
            }
            placeholder="e.g. +91 98765 43210"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder="Tell us about yourself..."
            rows={4}
            style={{
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "1rem",
              fontFamily: "inherit",
            }}
          />
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? "Updating..." : "Save Changes"}
        </button>

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}
