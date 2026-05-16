import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { logger } from "@/lib/utils";

interface TeamMember {
  _id?: string;
  name: string;
  role: string;
  module?: string;
  moduleRoles?: { module: string; role: string }[];
}

export default async function TeamPage() {
  let teamMembers: TeamMember[] = [];
  try {
    await dbConnect();
    const users = await User.find({
      role: { $in: ["Secretary", "OC", "Head"] },
      email: { $ne: "codingclub@iitg.ac.in" },
    }).lean();
    teamMembers = users as unknown as TeamMember[];
  } catch (e) {
    logger.error("Failed to fetch team members", e);
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Meet the Team</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        The passionate individuals driving innovation at Coding Club IITG.
      </p>

      <div
        style={{
          display: "grid",
          gap: "1.5rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {teamMembers.map((member, index) => (
          <div
            key={member._id || index}
            style={{
              border: "1px solid #eaeaea",
              padding: "2rem",
              borderRadius: "12px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              textAlign: "center",
              background: "white",
            }}
          >
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0070f3 0%, #00a4ff 100%)",
                margin: "0 auto 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                color: "white",
                fontWeight: "bold",
              }}
            >
              {member.name.charAt(0)}
            </div>
            <h2 style={{ margin: "0.5rem 0", fontSize: "1.4rem" }}>
              {member.name}
            </h2>
            <div
              style={{
                fontSize: "0.8rem",
                textTransform: "uppercase",
                background: "#0070f315",
                color: "#0070f3",
                padding: "0.3rem 0.8rem",
                borderRadius: "20px",
                fontWeight: "bold",
                display: "inline-block",
                marginBottom: "1rem",
                letterSpacing: "0.5px",
              }}
            >
              {member.role}
            </div>
            <p
              style={{ fontSize: "0.95rem", color: "#555", fontWeight: "500" }}
            >
              {member.module ||
                (member.moduleRoles && member.moduleRoles[0]?.module) ||
                "Coordinator"}
            </p>
            {(member as any).bio && (
              <p
                style={{
                  marginTop: "1rem",
                  fontSize: "0.85rem",
                  color: "#666",
                  lineHeight: "1.4",
                  fontStyle: "italic",
                  borderTop: "1px solid #f0f0f0",
                  paddingTop: "0.75rem",
                }}
              >
                {(member as any).bio}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
