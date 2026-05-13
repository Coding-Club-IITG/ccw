"use client";

import { useSession } from "@/lib/auth-client";
import { isAdmin } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import styles from "./PotdLayout.module.scss";

// Icons for navigation items
const Icons = {
  Daily: () => (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
  ),
  Leaderboard: () => (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
  ),
  Streak: () => (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.2 20.3c.7-.6 1.4-1.5 1.7-2.3.9-1.9-.3-3.6-1.5-5a8 8 0 0 1-2.4-5C6 5 8 2 8 2s1.5 2.1 2 4c.4 1.7 0 3.3-1 4.7-1.1 1.4-1.2 3.1-.3 4.6.6 1 1.4 1.6 2.3 2"></path><path d="M12 22s2.5-1.5 4-4.5c.3-.6.5-1.3.5-2 0-2.5-2-4.5-4-6V22z"></path></svg>
  ),
  Archive: () => (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
  ),
  Admin: () => (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
  ),
};

export default function PotdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const admin = user ? isAdmin(user.role) : false;
  
  const pathname = usePathname();
  
  const navItems = [
    { href: "/internal/potd", label: "Daily Challenge", icon: Icons.Daily, exact: true },
    { href: "/internal/potd/past-problems", label: "Past Problems", icon: Icons.Archive },
    { href: "/internal/potd/leaderboard", label: "Points Leaderboard", icon: Icons.Leaderboard },
    { href: "/internal/potd/streak", label: "Streak Leaderboard", icon: Icons.Streak },
  ];

  return (
    <div className={styles.layoutContainer}>
      <aside className={styles.sidebar}>
        <h3 className={styles.sidebarHeader}>POTD Navigator</h3>
        <ul className={styles.navList}>
          {navItems.map((item) => {
            const isActive = item.exact 
              ? pathname === item.href 
              : pathname?.startsWith(item.href);
              
            return (
              <li key={item.href} className={styles.navItem}>
                <Link 
                  href={item.href} 
                  className={`${styles.navLink} ${isActive ? styles.activeLink : ""}`}
                >
                  <item.icon />
                  {item.label}
                </Link>
              </li>
            );
          })}
          
          {admin && (
            <>
              <li className={styles.adminDivider} aria-hidden="true" />
              <li className={styles.navItem}>
                <Link 
                  href="/internal/potd/set-problem" 
                  className={`${styles.navLink} ${pathname?.startsWith("/internal/potd/set-problem") ? styles.activeLink : ""}`}
                >
                  <Icons.Admin />
                  Set Problem
                </Link>
              </li>
            </>
          )}
        </ul>
      </aside>

      <section className={styles.content}>
        {children}
      </section>
    </div>
  );
}
