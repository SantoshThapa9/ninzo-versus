import Link from "next/link";
import { AdminLink } from "@/components/shell/admin-link";
import { BottomNav } from "@/components/shell/bottom-nav";
import styles from "./app-shell.module.scss";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          NINZO <span>VERSUS</span>
        </Link>
        <nav className={styles.meta} aria-label="Utility navigation">
          <Link href="/competition-policy" className={styles.admin}>
            Rules
          </Link>
          <AdminLink />
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <BottomNav />
    </div>
  );
}
