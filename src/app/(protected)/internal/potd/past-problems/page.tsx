import styles from "../Lists.module.scss";
import { getPastProblems } from "@/lib/actions/potd";

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
                <th>Tags</th>
                <th>Solved By</th>
              </tr>
            </thead>
            <tbody>
              {pastProblems.map((p) => {
                const istMs =
                  new Date(p.windowStart).getTime() + 5.5 * 60 * 60 * 1000;
                const dateLabel = new Date(istMs).toLocaleDateString("en-IN", {
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
                      <div className={styles.tags}>
                        {p.problem.tags.map((t: string) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
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
