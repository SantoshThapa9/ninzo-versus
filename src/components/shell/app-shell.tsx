import Link from "next/link";
import { auth } from "@/auth";
import { ChallengeAcceptanceNotifier } from "@/components/match/challenge-acceptance-notifier";
import { AdminLink } from "@/components/shell/admin-link";
import { BottomNav } from "@/components/shell/bottom-nav";
import { AppTour } from "@/components/onboarding/app-tour";
import styles from "./app-shell.module.scss";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className={styles.shell}>
      <ChallengeAcceptanceNotifier userId={session?.user?.id} />
      <AppTour />
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          NINZO VERSUS
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
