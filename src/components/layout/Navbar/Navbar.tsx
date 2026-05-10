import Link from "next/link";
import { auth } from "@/lib/auth";
import styles from "./Navbar.module.scss";

export default async function Navbar() {
  const session = await auth();

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.logo}>
        CC IITG
      </Link>
      <div className={styles.navLinks}>
        <Link href="/">Home</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/team">Team</Link>
        {session ? (
          <Link href="/internal/dashboard">Dashboard</Link>
        ) : (
          <Link href="/login" className={styles.authButton}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
