import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import styles from "./home.module.scss";

export const revalidate = 86400;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <section className={styles.hero} aria-labelledby="home-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsOrganization",
            name: "Ninzo Versus",
            url: "https://ninzo-versus.com",
            description: "Skill-based gaming platform for daily free esports tournaments and competitive 1v1 challenges.",
            areaServed: "IN",
          }),
        }}
      />
      <p className={styles.kicker}>India • Skill-Based Gaming • Hosted Cups</p>
      <h1 id="home-heading" className={styles.title}>Play. Prove. Claim esports rewards.</h1>
      <p className={styles.lead}>
        Competitive 1v1 challenges, daily free esports tournaments, and
        performance-based rewards verified against official results.
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
          <h2 className="mb-2 text-base font-bold">Competitive 1v1 challenges</h2>
          <p className="text-sm text-[var(--muted)]">
            Choose a format, register for a match, and prove your skill in
            structured Clash Squad competition.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-bold">Daily free esports tournaments</h2>
          <p className="text-sm text-[var(--muted)]">
            Build your record through free skill-based gaming and organizer-led
            tournament competition.
          </p>
        </Card>
      </div>
    </section>
  );
}
