import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();

  // Redundant check because of middleware, but good for safety
  if (
    session?.user.role !== "Secretary" &&
    session?.user.role !== "OC" &&
    session?.user.role !== "Core Team"
  ) {
    redirect("/internal/dashboard");
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ color: "red" }}>Website Administration</h1>
      <p>Management portal for Secretary, OC, and Core Team members.</p>

      <div
        style={{
          marginTop: "2rem",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          <h3>Manage Users & Roles</h3>
          <p style={{ fontSize: "0.9rem", color: "#666" }}>
            Assign module roles, promote coordinators, etc.
          </p>
        </div>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          <h3>Global Settings</h3>
          <p style={{ fontSize: "0.9rem", color: "#666" }}>
            Update club info, maintenance mode, etc.
          </p>
        </div>
      </div>
    </div>
  );
}
