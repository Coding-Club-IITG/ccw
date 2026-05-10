import dbConnect from "@/lib/mongodb";
import Project, { IProject } from "@/models/Project";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage() {
  await dbConnect();
  const projects = (await Project.find({})
    .sort({ date: -1 })
    .lean()) as unknown as IProject[];

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Projects & Events</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Discover what we've been building and the events we've hosted.
      </p>

      {projects.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            border: "1px dashed #ccc",
          }}
        >
          <p>No projects or events found. Stay tuned for updates!</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {projects.map((project) => (
            <div
              key={String(project._id)}
              style={{
                border: "1px solid #eaeaea",
                padding: "1.5rem",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  background: "#0070f310",
                  color: "#0070f3",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: "bold",
                }}
              >
                {project.module}
              </span>
              <h2 style={{ margin: "0.5rem 0", fontSize: "1.25rem" }}>
                {project.title}
              </h2>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#444",
                  marginBottom: "1rem",
                }}
              >
                {project.description}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  color: "#888",
                }}
              >
                <span>{formatDate(project.date)}</span>
                <span style={{ fontWeight: "600" }}>{project.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
