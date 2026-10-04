import Link from "next/link";
import { AdminLink } from "@/components/shell/admin-link";
import { BottomNav } from "@/components/shell/bottom-nav";
import { AppTour } from "@/components/onboarding/app-tour";
import styles from "./app-shell.module.scss";

export async function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <AppTour />
      <header className={styles.header}>
        <Link href="/" prefetch={false} className={styles.brand}>
          NINZO VERSUS
        </Link>
        <nav className={styles.meta} aria-label="Utility navigation">
          <Link href="/competition-policy" prefetch={false} className={styles.admin}>
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
