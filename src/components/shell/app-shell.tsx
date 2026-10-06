import Link from "next/link";
import { AdminLink } from "@/components/shell/admin-link";
import { BottomNav } from "@/components/shell/bottom-nav";
import { AppTour } from "@/components/onboarding/app-tour";
import { RankRouteRefresh } from "@/components/shell/rank-route-refresh";
import styles from "./app-shell.module.scss";
import Image from "next/image";

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
          <Link
            href="/competition-policy"
            prefetch={false}
            className={styles.admin}
          >
            <Image
              src="/policy.webp"
              alt="Competition Policy"
              width={20}
              height={20}
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
