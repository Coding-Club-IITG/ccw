import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import UserManagement from "@/components/admin/UserManagement";
import { isAdmin } from "@/lib/utils";

export default async function AdminPage() {
  const session = await auth();

  if (!session || !isAdmin(session.user.role)) {
    redirect("/internal/dashboard");
  }

  return (
    <div style={{ padding: "1rem 0" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          CC Administration
        </h1>
        <p style={{ color: "#666" }}>
          User management and global settings for the Coding Club website.
        </p>
      </header>

      <section
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid #eee",
        }}
      >
        <h2
          style={{
            marginBottom: "1.5rem",
            borderBottom: "2px solid #f4f4f4",
            paddingBottom: "0.5rem",
          }}
        >
          User & Role Management
        </h2>
        <UserManagement />
      </section>

      <div
        style={{
          marginTop: "2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eee",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          <h3>Global Settings</h3>
          <p style={{ fontSize: "0.9rem", color: "#666" }}>
            Club-wide announcements and maintenance settings (Coming Soon).
          </p>
        </div>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eee",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          <h3>Audit Logs</h3>
          <p style={{ fontSize: "0.9rem", color: "#666" }}>
            Track administrative changes and user logins (Coming Soon).
          </p>
        </div>
      </div>
    </div>
  );
}
