import Link from "next/link";
import { auth } from "@/auth";
import { UserRole } from "@/types/enums";
import { BottomNav } from "@/components/shell/bottom-nav";
import styles from "./app-shell.module.scss";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          NINZO <span>VERSUS</span>
        </Link>
        <div className={styles.meta}>
          {session?.user?.role === UserRole.ADMIN ? (
            <Link href="/admin" className={styles.admin}>
              Admin
            </Link>
          ) : null}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      {session ? <BottomNav /> : null}
    </div>
  );
}
