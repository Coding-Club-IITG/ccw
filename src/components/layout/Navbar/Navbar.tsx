import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import styles from "./Navbar.module.scss";

export default async function Navbar() {
  const session = await auth();

  return (
    <nav className={styles.navbar}>
      <Link
        href={session ? "/internal/dashboard" : "/"}
        className={styles.logo}
      >
        CC IITG
      </Link>
      <div className={styles.navLinks}>
        {session ? (
          <>
            <Link href="/internal/dashboard" className={styles.dashboardLink}>
              Dashboard
            </Link>
            <Link href="/internal/profile">Profile</Link>
            <Link href="/internal/files">Files</Link>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button type="submit" className={styles.authButton}>
                Logout
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/">Home</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/team">Team</Link>
            <form
              action={async () => {
                "use server";
                if (process.env.DEV_BYPASS === "1") {
                  await signIn("dev-login", {
                    redirectTo: "/internal/dashboard",
                  });
                } else {
                  await signIn("microsoft-entra-id", {
                    redirectTo: "/internal/dashboard",
                  });
                }
              }}
            >
              <button type="submit" className={styles.authButton}>
                Login
              </button>
            </form>
          </>
        )}
      </div>
    </nav>
  );
}
