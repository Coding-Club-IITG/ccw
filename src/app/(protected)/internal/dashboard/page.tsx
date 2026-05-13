import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // session is guaranteed by proxy
  const user = session!.user as any;
  const moduleRoles = user.moduleRoles || [];

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Member Dashboard</h1>
      <p>Welcome back, {user.name}!</p>

      <div style={{ marginTop: "2rem", display: "grid", gap: "1rem" }}>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eaeaea",
            borderRadius: "8px",
          }}
        >
          <h3>Your Roles</h3>
          <ul>
            <li>Global Role: {user.role}</li>
            {moduleRoles.map((mr: any, i: number) => (
              <li key={i}>
                {mr.module}: {mr.role}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eaeaea",
            borderRadius: "8px",
          }}
        >
          <h3>Quick Links</h3>
          <ul>
            <li>
              <a href="/internal/profile">Update Profile</a>
            </li>
            <li>
              <a href="/internal/leaderboard">Codeforces Leaderboard</a>
            </li>
            <li>
              <a href="/internal/files">Files Sharing</a>
            </li>
            {isAdmin(user.role) && (
              <li>
                <a href="/admin">Website Administration</a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
