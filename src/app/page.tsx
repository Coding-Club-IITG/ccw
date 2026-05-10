import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "3.5rem",
          marginBottom: "1rem",
          color: "var(--primary)",
        }}
      >
        Coding Club IITG
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          maxWidth: "600px",
          marginBottom: "2.5rem",
          color: "#666",
        }}
      >
        The heartbeat of technology and innovation at IIT Guwahati. We build, we
        learn, and we excel together.
      </p>

      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/projects"
          style={{
            background: "var(--primary)",
            color: "white",
            padding: "0.75rem 1.5rem",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Explore Projects
        </Link>
        <Link
          href="/team"
          style={{
            border: "1px solid var(--primary)",
            color: "var(--primary)",
            padding: "0.75rem 1.5rem",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Meet the Team
        </Link>
      </div>

      <div
        style={{
          marginTop: "5rem",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "2rem",
          maxWidth: "1000px",
        }}
      >
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eee",
            borderRadius: "12px",
          }}
        >
          <h3>Software Dev</h3>
          <p style={{ fontSize: "0.9rem", color: "#777" }}>
            Building scalable solutions and modern applications.
          </p>
        </div>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eee",
            borderRadius: "12px",
          }}
        >
          <h3>Machine Learning</h3>
          <p style={{ fontSize: "0.9rem", color: "#777" }}>
            Harnessing the power of data and artificial intelligence.
          </p>
        </div>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #eee",
            borderRadius: "12px",
          }}
        >
          <h3>Cybersecurity</h3>
          <p style={{ fontSize: "0.9rem", color: "#777" }}>
            Securing the digital frontier and exploring vulnerabilities.
          </p>
        </div>
      </div>
    </div>
  );
}
