import styles from "../Lists.module.scss";
import { getPastProblems } from "@/lib/actions/potd";
import { DIFFICULTY_COLORS } from "@/lib/constants";
import { windowStartToISTDateStr } from "@/lib/potd-utils";

export default async function PastProblemsPage() {
  const result = await getPastProblems(30);
  const pastProblems = result.data ?? [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Past Problems</h1>
        <p>A history of all previous Problems of the Day.</p>
      </div>

      {pastProblems.length === 0 ? (
        <p style={{ color: "#666", padding: "2rem 0" }}>
          No past problems yet.
        </p>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Problem</th>
                <th>Rating</th>
                <th>Difficulty</th>
                <th>Solved By</th>
              </tr>
            </thead>
            <tbody>
              {pastProblems.map((p) => {
                const dateLabel = new Date(
                  windowStartToISTDateStr(p.windowStart) + "T00:00:00Z",
                ).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const problemLabel = `${p.problem.cfContestId}-${p.problem.cfIndex}`;
                const problemUrl = `https://codeforces.com/problemset/problem/${p.problem.cfContestId}/${p.problem.cfIndex}`;

                return (
                  <tr key={p.challengeId}>
                    <td className={styles.subText}>{dateLabel}</td>
                    <td>
                      <span className={styles.problemId}>
                        CF {problemLabel}
                      </span>
                      <a
                        href={problemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.problemTitle}
                      >
                        {p.problem.name}
                      </a>
                    </td>
                    <td>
                      <span className={styles.rating}>
                        {p.problem.rating || "Unrated"}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: DIFFICULTY_COLORS[p.difficulty],
                          padding: "2px 8px",
                          borderRadius: "999px",
                          border: `1px solid ${DIFFICULTY_COLORS[p.difficulty]}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.difficulty}
                      </span>
                    </td>
                    <td className={styles.boldText}>{p.solvedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
