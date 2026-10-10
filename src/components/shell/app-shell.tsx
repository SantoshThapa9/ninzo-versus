import Link from "next/link";
import { AdminLink } from "@/components/shell/admin-link";
import { BottomNav } from "@/components/shell/bottom-nav";
import { AppTour } from "@/components/onboarding/app-tour";
import { RankRouteRefresh } from "@/components/shell/rank-route-refresh";
import styles from "./app-shell.module.scss";
import Image from "next/image";
import { ScrollText } from "lucide-react";

export async function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <AppTour />
      <RankRouteRefresh />
      <header className={styles.header}>
        <Link href="/" prefetch={false} className={styles.brand}>
          NINZO VERSUS
        </Link>
        <nav className={styles.meta} aria-label="Utility navigation">
          <Link href="/competition-policy" prefetch={false}>
            <ScrollText
              height={16}
              width={16}
              className="text-[var(--muted)]"
            />
          </Link>
          <AdminLink />
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <BottomNav />
    </div>
  );
}
