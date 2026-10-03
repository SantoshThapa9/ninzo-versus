"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRole } from "@/types/enums";
import styles from "./app-shell.module.scss";

type SessionResponse = { user?: { role?: string } } | null;

export function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { signal: AbortSignal.timeout(4_000) })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Session request failed with ${response.status}.`);
        }
        return response.json();
      })
      .then((session: SessionResponse) => setIsAdmin(session?.user?.role === UserRole.ADMIN))
      .catch((error: unknown) => {
        console.error("[navigation] Could not load the current session.", error);
        setIsAdmin(false);
      });
  }, []);

  return isAdmin ? (
    <Link href="/admin" className={styles.admin}>
      Admin
    </Link>
  ) : null;
}
