"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "@/lib/auth-client";
import { useState } from "react";
import styles from "./Navbar.module.scss";

export default function Navbar() {
  const { data: session, isPending } = useSession();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
            <Link href="/internal/potd">POTD</Link>
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
              disabled={isLoggingIn || isPending}
              onClick={async () => {
                setIsLoggingIn(true);
                await signIn.social({
                  provider: "microsoft",
                  callbackURL: "/internal/dashboard",
                  errorCallbackURL: "/?error=unauthorized",
                });
              }}
              className={styles.authButton}
            >
              {isLoggingIn ? "Redirecting..." : "Login"}
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
