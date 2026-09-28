import Link from "next/link";
import styles from "./admin-nav.module.scss";

const items = [
  ["/admin", "Home"],
  ["/admin/matches", "Matches"],
  ["/admin/events", "Events"],
  ["/admin/withdrawals", "Reward fulfillment"],
  ["/admin/support", "Support"],
];

export function AdminNav() {
  return (
    <nav className={styles.nav}>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className={styles.link}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
