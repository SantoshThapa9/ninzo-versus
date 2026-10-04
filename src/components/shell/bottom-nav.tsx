"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gamepad2,
  Package,
  LifeBuoy,
  UserRound,
  MessagesSquare,
  Medal,
} from "lucide-react";
import styles from "./bottom-nav.module.scss";

const items = [
  { href: "/", label: "Lobby", icon: Gamepad2 },
  { href: "/matches", label: "Matches", icon: MessagesSquare },
  { href: "/rank", label: "Rank", icon: Medal },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/profile", label: "Me", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Primary navigation">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            data-tour={item.href === "/" ? "clash-nav" : undefined}
            className={`${styles.item} ${active ? styles.active : ""}`}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
