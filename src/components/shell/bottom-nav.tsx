"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Trophy, Wallet, LifeBuoy, UserRound, MessagesSquare } from "lucide-react";
import styles from "./bottom-nav.module.scss";

const items = [
  { href: "/lobby", label: "Clash", icon: Gamepad2 },
  { href: "/events", label: "Events", icon: Trophy },
  { href: "/matches", label: "Matches", icon: MessagesSquare },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/profile", label: "Me", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`}>
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
