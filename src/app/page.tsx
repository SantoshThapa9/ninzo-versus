import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import styles from "./home.module.scss";

export default function Home() {
  return (
    <section className={styles.hero}>
      <p className={styles.kicker}>India • Clash Squad • Hosted Cups</p>
      <h1 className={styles.title}>Play. Prove. Get paid in NV Coins.</h1>
      <p className={styles.lead}>
        ₹1 = 1 NV Coin. Dynamic P2P stakes, admin-hosted events, AI-assisted
        proof, and human-final decisions.
      </p>
      <div className={styles.actions}>
        <Button asChild size="full">
          <Link href="/register">Create account</Link>
        </Button>
        <Button asChild variant="secondary" size="full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
      <div className={styles.grid}>
        <Card>
          <h2 className="mb-2 text-base font-bold">User Clash Squad</h2>
          <p className="text-sm text-[var(--muted)]">
            1v1 to 6v6. Post a stake range, lock the max, accept inside the
            range, refund the rest.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-bold">Hosted nights</h2>
          <p className="text-sm text-[var(--muted)]">
            Admin publishes only when tonight is on. No draft event can take
            payments or slots.
          </p>
        </Card>
      </div>
    </section>
  );
}
