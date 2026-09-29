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
    <section className={styles.hero} aria-labelledby="home-heading" data-tour="tour-welcome">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://ninzo-versus.vercel.app/#organization",
                name: "Ninzo Versus",
                url: "https://ninzo-versus.vercel.app",
                logo: "https://ninzo-versus.vercel.app/nv.jpg",
                sameAs: ["https://www.youtube.com/@ninzolive"],
                description:
                  "An esports platform for Garena Free Fire MAX tournaments and 1v1 challenges in India.",
              },
              {
                "@type": "WebSite",
                "@id": "https://ninzo-versus.vercel.app/#website",
                name: "Ninzo Versus",
                url: "https://ninzo-versus.vercel.app",
                inLanguage: "en-IN",
                publisher: {
                  "@id": "https://ninzo-versus.vercel.app/#organization",
                },
              },
            ],
          }),
        }}
      />
      <p className={styles.kicker}>
        India • Free Fire MAX • Esports Challenges
      </p>
      <h1 id="home-heading" className={styles.title}>
        Garena Free Fire MAX tournaments and 1v1 challenges.
      </h1>
      <p className={styles.lead}>
        Ninzo Versus hosts free Garena Free Fire MAX tournaments and competitive
        1v1 esports challenges for players in India.
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
          <h2 className="mb-2 text-base font-bold">
            Competitive 1v1 challenges
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Choose a format, register for a Garena Free Fire MAX 1v1 match, and
            prove your skill in structured Clash Squad competition.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-bold">
            Daily free esports tournaments
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Join free Garena Free Fire MAX tournaments and organizer-led esports
            challenges to build your competitive record.
          </p>
        </Card>
      </div>
    </section>
  );
}
