"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { updateProfile } from "@/lib/actions/user";
import { requestHandleVerification } from "@/lib/actions/cf";
import styles from "./ProfileForm.module.scss";

export default function ProfileForm() {
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    codeforcesId: "",
    githubId: "",
    bio: "",
    phoneNumber: "",
  });

  const [cfVerificationToken, setCfVerificationToken] = useState("");
  const [cfVerified, setCfVerified] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || "",
        codeforcesId: (session.user as any).codeforcesId || "",
        githubId: (session.user as any).githubId || "",
        bio: (session.user as any).bio || "",
        phoneNumber: (session.user as any).phoneNumber || "",
      });
      setCfVerified((session.user as any).cfVerified || false);
      setCfVerificationToken((session.user as any).cfVerificationToken || "");
    }
  }, [session]);

  async function handleVerifySubmit() {
    setVerifying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cf/verify-handle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Verification failed",
        });
        return;
      }
      setCfVerified(true);
      setCfVerificationToken("");
      setMessage({ type: "success", text: "Codeforces handle verified!" });
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setVerifying(false);
    }
  }

  async function handleRequestToken() {
    setVerifying(true);
    setMessage(null);
    const result = await requestHandleVerification(formData.codeforcesId);
    setVerifying(false);
    if (!result.ok) {
      setMessage({
        type: "error",
        text: result.error || "Failed to generate token",
      });
    } else {
      setCfVerificationToken(result.token!);
      setMessage({
        type: "success",
        text: "Token generated. Please update your CF profile.",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await updateProfile(formData);
    setLoading(false);

    if (!result.success) {
      setMessage({
        type: "error",
        text: result.error || "Failed to update profile.",
      });
    } else {
      setMessage({
        type: "success",
        text: "Profile updated successfully! Refresh to see changes.",
      });
    }
  }

  if (isPending) return <div>Loading...</div>;

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
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              id="codeforces"
              value={formData.codeforcesId}
              onChange={(e) =>
                setFormData({ ...formData, codeforcesId: e.target.value })
              }
              placeholder="e.g. tourist"
            />
            {cfVerified && (
              <span style={{ color: "green", fontWeight: "bold" }}>
                Verified ✓
              </span>
            )}
          </div>

          {formData.codeforcesId && !cfVerified && (
            <div
              style={{
                marginTop: "12px",
                padding: "1rem",
                background: "#fef3c7",
                border: "1px solid #ffeeba",
                borderRadius: "8px",
                color: "#856404",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: cfVerificationToken ? "12px" : "0",
                }}
              >
                <span style={{ fontSize: "0.95rem" }}>
                  <strong>Unverified Handle.</strong>
                  {!cfVerificationToken && " Generate a secure token to begin."}
                </span>
                {!cfVerificationToken && (
                  <button
                    type="button"
                    onClick={handleRequestToken}
                    disabled={verifying}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "1px solid #856404",
                      background: "transparent",
                      color: "#856404",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {verifying ? "Wait..." : "Get Token"}
                  </button>
                )}
              </div>

              {cfVerificationToken && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                    lineHeight: "1.6",
                  }}
                >
                  <ol style={{ margin: "0 0 12px 0", paddingLeft: "1.2rem" }}>
                    <li>
                      Update your Codeforces <strong>First Name</strong> to:
                      <code
                        style={{
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          marginLeft: "8px",
                          fontFamily: "monospace",
                          fontSize: "1rem",
                          fontWeight: "bold",
                          color: "#b45309",
                        }}
                      >
                        {cfVerificationToken}
                      </code>
                    </li>
                    <li style={{ marginTop: "6px" }}>
                      Wait a few seconds for Codeforces to update, then click
                      verify.
                    </li>
                  </ol>
                  <button
                    type="button"
                    onClick={handleVerifySubmit}
                    disabled={verifying}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "none",
                      background: "#856404",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: "bold",
                      width: "100%",
                      transition: "opacity 0.2s",
                    }}
                  >
                    {verifying
                      ? "Checking with Codeforces..."
                      : "Verify Handle"}
                  </button>
                </div>
              )}
            </div>
          )}
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
