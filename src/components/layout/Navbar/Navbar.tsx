"use client";

import Link from "next/link";
import { useSession, signIn, signOut, authClient } from "@/lib/auth-client";
import styles from "./Navbar.module.scss";

export default function Navbar() {
  const { data: session, isPending } = useSession();

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
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/";
              }}
              className={styles.authButton}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/">Home</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/team">Team</Link>
            <button
              onClick={async () => {
                if (process.env.NEXT_PUBLIC_DEV_BYPASS === "1") {
                  const res = await authClient.$fetch("/sign-in/dev", {
                    method: "POST",
                    body: {
                      email: "codingclub@iitg.ac.in",
                    },
                  });
                  if (res.data) {
                    window.location.href = "/";
                  }
                } else {
                  await signIn.social({
                    provider: "microsoft",
                    callbackURL: "/",
                  });
                }
              }}
              className={styles.authButton}
            >
              Login
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
