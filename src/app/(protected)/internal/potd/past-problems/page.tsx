import styles from "../Lists.module.scss";

// Dummy JSON Data
const pastProblems = [
  { id: "1722-C", title: "Jumping on Tiles", date: "May 11, 2026", rating: 1500, tags: ["dp", "strings"], solvedBy: 42 },
  { id: "1800-B", title: "Count the Number of Pairs", date: "May 10, 2026", rating: 1100, tags: ["greedy", "math"], solvedBy: 68 },
  { id: "1850-D", title: "Balanced Round", date: "May 09, 2026", rating: 900, tags: ["sortings", "two pointers"], solvedBy: 85 },
  { id: "1554-C", title: "Mikasa", date: "May 08, 2026", rating: 1700, tags: ["bitmasks", "constructive"], solvedBy: 15 },
  { id: "1669-F", title: "Eating Candies", date: "May 07, 2026", rating: 1100, tags: ["two pointers", "binary search"], solvedBy: 72 },
];

export default function PastProblemsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Past Problems</h1>
        <p>A history of all previous Problems of the Day.</p>
      </div>

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
            {pastProblems.map((p) => (
              <tr key={p.id}>
                <td className={styles.subText}>{p.date}</td>
                <td>
                  <span className={styles.problemId}>CF {p.id}</span>
                  <a href={`https://codeforces.com/problemset/problem/${p.id.split('-')[0]}/${p.id.split('-')[1]}`} target="_blank" rel="noreferrer" className={styles.problemTitle}>
                    {p.title}
                  </a>
                </td>
                <td><span className={styles.rating}>{p.rating}</span></td>
                <td>
                  <div className={styles.tags}>
                    {p.tags.map(t => <span key={t}>{t}</span>)}
                  </div>
                </td>
                <td className={styles.boldText}>{p.solvedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
