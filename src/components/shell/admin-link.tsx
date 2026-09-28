"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRole } from "@/types/enums";
import styles from "./app-shell.module.scss";

type SessionResponse = { user?: { role?: string } } | null;

export function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((session: SessionResponse) => setIsAdmin(session?.user?.role === UserRole.ADMIN))
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin ? (
    <Link href="/admin" className={styles.admin}>
      Admin
    </Link>
  ) : null;
}
