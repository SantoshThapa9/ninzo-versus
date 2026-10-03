import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Competition Policy | Ninzo Versus",
  description:
    "Ninzo Versus competition, participation, rewards, NV Tokens, premium features, and platform rules.",
  alternates: { canonical: "/competition-policy" },
};

const sections = [
  {
    number: "01",
    title: "Skill-based competition",
    children: (
      <>
        <p>
          Ninzo Versus is a competitive gaming and player showcase platform.
          Players participate in skill-based competitions, challenges, and
          esports activities where results are determined by performance, and
          the rules published for each competition.
        </p>
      </>
    ),
  },
  {
    number: "02",
    title: "Free tournaments & participation",
    children: (
      <>
        <p>
          Ninzo Versus may provide free tournaments and competitive events where
          players can participate without purchasing anything.
        </p>
        <p>
          Where a tournament offers an organizer-funded reward, the reward is
          disclosed before participation and is awarded according to the
          published competition rules and verified results.
        </p>
        <p>
          {
            " Purchasing a product, premium feature, or NV Tokens does not improve a player's chance of winning a competition."
          }
        </p>
      </>
    ),
  },
  {
    number: "03",
    title: "NV Tokens",
    children: (
      <>
        <p>
          NV Tokens are internal platform credits used to access selected
          premium features and digital benefits within Ninzo.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            "Global rank showcase features",
            "Profile enhancement options",
            "Additional free platform rewards",
            "Feature and profile unlocks",
            "Post publishing and showcase features",
            "Limited social-media promotion opportunities",
            "Ninzo premium membership benefits",
            "Other platform-defined digital features",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-sm text-[var(--foreground)]"
            >
              <span className="mr-2 text-[var(--accent)]">+</span>
              {item}
            </div>
          ))}
        </div>

        <p className="mt-4">
          NV Tokens are not a bank balance, payment account, investment,
          security, cryptocurrency, or general-purpose currency. They have no
          independent monetary value outside the Ninzo platform and cannot be
          redeemed for cash.
        </p>

        <p>
          NV Tokens are not used as wagers, stakes, bets, or prizes in
          competitions. They do not represent ownership of Ninzo or any other
          financial interest.
        </p>
      </>
    ),
  },
  {
    number: "04",
    title: "Premium membership & platform features",
    children: (
      <>
        <p>
          Ninzo may offer optional premium features designed to help players
          build, customize, and showcase their gaming identity.
        </p>
        <p>
          Depending on availability, these features may include enhanced
          profiles, global-rank visibility, additional free rewards, publishing
          tools, feature unlocks, premium membership status, and limited
          promotional opportunities for eligible gaming or social channels.
        </p>
        <p>
          Premium features are platform services. They do not provide an
          advantage in determining competition results.
        </p>
      </>
    ),
  },
  {
    number: "05",
    title: "Player showcase",
    children: (
      <>
        <p>
          Ninzo Versus is designed to help players compete, build their gaming
          profile, and showcase their achievements to a wider community.
        </p>
        <p>
          {
            "Global rankings, profiles, achievements, badges, posts, tournament history, and other public-facing features may be used to highlight a player's competitive activity and participation. "
          }
        </p>
        <p>
          Players are responsible for ensuring that content, usernames, images,
          links, and social-media accounts they submit comply with applicable
          laws and the Ninzo community rules.
        </p>
      </>
    ),
  },
  {
    number: "06",
    title: "Rewards & fulfillment",
    children: (
      <>
        <p>
          Organizer-funded rewards, where offered, are separate from player
          purchases and NV Tokens. Reward details and eligibility requirements
          are communicated with the relevant competition or event.
        </p>
        <p>
          Rewards are verified against the applicable official results and
          fulfilled by the organizer according to the published event rules.
        </p>
        <p>
          Not every competition or activity provides a reward. Participation
          should not be interpreted as creating an entitlement to a cash payment
          or financial return.
        </p>
      </>
    ),
  },
  {
    number: "07",
    title: "Digital items & badges",
    children: (
      <>
        <p>
          Badges, profile items, participation markers, achievements, and
          similar digital items are platform features intended for identity,
          recognition, and player progression.
        </p>
        <p>
          Unless specifically stated otherwise by Ninzo, these items are
          non-transferable, non-redeemable, and cannot be exchanged for cash or
          used as competition stakes.
        </p>
      </>
    ),
  },
  {
    number: "08",
    title: "Competition integrity",
    children: (
      <>
        <p>
          Players must follow the rules of the relevant tournament, competition
          room, and Ninzo platform.
        </p>
        <p>
          Cheating, match manipulation, exploitation of bugs, unauthorized
          software, impersonation, result tampering, or other conduct that
          compromises competitive integrity may result in disqualification,
          removal of results, restriction of features, or account action.
        </p>
      </>
    ),
  },
];

export default function CompetitionPolicyPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
      >
        <div className="absolute left-1/2 top-[-220px] h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-[var(--accent)]/10 blur-[120px]" />
        <div className="absolute right-[-160px] top-[100px] h-[300px] w-[300px] rounded-full bg-[var(--accent-2)]/5 blur-[100px]" />
      </div>

      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-[var(--accent)]" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Ninzo Versus
            </p>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">
              Competition Policy
              <span className="block text-[var(--accent-2)]">
                & Platform Terms
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              competitive gaming, free tournaments, player showcases, digital
              rewards, NV Tokens, premium features, and participation across
              Ninzo.
            </p>
          </div>

          {/* Policy summary */}
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)]/80 p-4">
              <div className="mb-2 text-lg font-black text-[var(--accent)]">
                SKILL
              </div>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Results are based on performance and published rules.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)]/80 p-4">
              <div className="mb-2 text-lg font-black text-[var(--accent-2)]">
                SHOWCASE
              </div>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Build your profile, achievements, rank, and gaming identity.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)]/80 p-4">
              <div className="mb-2 text-lg font-black text-[var(--foreground)]">
                DIGITAL
              </div>
              <p className="text-xs leading-5 text-[var(--muted)]">
                NV Tokens unlock platform features and digital benefits.
              </p>
            </div>
          </div>
        </header>

        {/* Policy cards */}
        <div className="grid gap-4">
          {sections.map((section) => (
            <Card
              key={section.number}
              className="group relative overflow-hidden border-[var(--line)] bg-[var(--card)]/90 p-5 shadow-none transition-colors duration-200 hover:border-[var(--accent)]/30 sm:p-6"
            >
              <div
                aria-hidden="true"
                className="absolute left-0 top-0 h-full w-[2px] bg-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[10px] font-black text-[var(--accent)]">
                    {section.number}
                  </div>

                  <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                    {section.title}
                  </h2>
                </div>

                <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--muted)]">
                  {section.children}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Agreement */}
        <div className="mt-6 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />

            <div>
              <h2 className="font-bold text-[var(--foreground)]">
                Participation agreement
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                By participating in a Ninzo competition or using competition
                features, you agree to follow the applicable competition rules,
                tournament rules, result-review process, community standards,
                and organizer decisions.
              </p>

              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                For questions about competitions, rewards, accounts, or platform
                features,{" "}
                <Link
                  className="font-semibold text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--accent-2)]"
                  href="/support"
                >
                  contact support
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]/70">
          Ninzo may update these terms as its competitions, digital features,
          and platform services evolve. The rules applicable to a particular
          event or feature will be presented before participation where
          applicable.
        </p>
      </section>
    </main>
  );
}
