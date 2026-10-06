import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Competition Rules | Ninzo Versus",
  description:
    "Ninzo Versus competition rules, participation, rewards, NV Tokens, player showcases, and platform policies.",
  alternates: { canonical: "/competition-policy" },
};

const sections = [
  {
    number: "01",
    label: "CORE",
    title: "Skill-based competition",
    children: (
      <>
        <p>
          Ninzo Versus is a competitive gaming and player showcase platform.
          Players participate in skill-based competitions, challenges, and
          esports activities where results are determined by player performance
          and the rules published for each competition.
        </p>
      </>
    ),
  },
  {
    number: "02",
    label: "ENTRY",
    title: "Free tournaments & participation",
    children: (
      <>
        <p>
          Ninzo Versus may provide free tournaments and competitive events where
          players can participate without purchasing anything.
        </p>
        <p>
          Where an organizer-funded reward is offered, the reward is disclosed
          before participation and is awarded according to the published
          competition rules and verified results.
        </p>
        <p>
          Purchasing a product, premium feature, or NV Tokens does not improve a
          player&apos;s chance of winning a competition.
        </p>
      </>
    ),
  },
  {
    number: "03",
    label: "TOKENS",
    title: "NV Tokens",
    children: (
      <>
        <p>
          NV Tokens are internal platform credits used to access selected
          premium features and digital benefits within Ninzo Versus.
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
              className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/30"
            >
              <span className="mr-2 text-[var(--accent)]">+</span>
              {item}
            </div>
          ))}
        </div>

        <p className="mt-4">
          NV Tokens are not a bank balance, payment account, investment,
          security, cryptocurrency, or general-purpose currency. They have no
          independent monetary value outside the Ninzo Versus platform and
          cannot be redeemed for cash.
        </p>
        <p>
          NV Tokens are not used as wagers, stakes, bets, or prizes in
          competitions. They do not represent ownership of Ninzo Versus or any
          other financial interest.
        </p>
      </>
    ),
  },
  {
    number: "04",
    label: "PREMIUM",
    title: "Premium membership & platform features",
    children: (
      <>
        <p>
          Ninzo Versus may offer optional premium features designed to help
          players build, customize, and showcase their gaming identity.
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
    label: "SHOWCASE",
    title: "Player showcase",
    children: (
      <>
        <p>
          Ninzo Versus is designed to help players compete, build their gaming
          profile, and showcase their achievements to a wider community.
        </p>
        <p>
          Global rankings, profiles, achievements, badges, posts, tournament
          history, and other public-facing features may be used to highlight a
          player&apos;s competitive activity and participation.
        </p>
        <p>
          Players are responsible for ensuring that content, usernames, images,
          links, and social-media accounts they submit follow Ninzo Versus
          community rules and any requirements that apply to their content.
        </p>
      </>
    ),
  },
  {
    number: "06",
    label: "REWARDS",
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
    label: "DIGITAL",
    title: "Digital items & badges",
    children: (
      <>
        <p>
          Badges, profile items, participation markers, achievements, and
          similar digital items are platform features intended for identity,
          recognition, and player progression.
        </p>
        <p>
          Unless specifically stated otherwise by Ninzo Versus, these items are
          non-transferable, non-redeemable, and cannot be exchanged for cash or
          used as competition stakes.
        </p>
      </>
    ),
  },
  {
    number: "08",
    label: "INTEGRITY",
    title: "Competition integrity",
    children: (
      <>
        <p>
          Players must follow the rules of the relevant tournament, competition
          room, and Ninzo Versus platform.
        </p>
        <p>
          Cheating, match manipulation, exploitation of bugs, unauthorized
          software, impersonation, result tampering, or other conduct that
          compromises competitive integrity may result in disqualification,
          removal of results, feature restrictions, or account action.
        </p>
      </>
    ),
  },
  {
    number: "09",
    label: "POLICIES",
    title: "Platform rules, Terms & Privacy",
    children: (
      <>
        <p>
          Competition activities follow the rules published by Ninzo Versus.
          Players must also follow the platform&apos;s Terms of Service and
          Privacy Policy.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Platform Rules", "Competition and platform requirements."],
            ["Terms of Service", "General terms for using Ninzo Versus."],
            ["Privacy Policy", "How platform data and privacy are handled."],
          ].map(([title, description]) => (
            <div
              key={title}
              className="rounded-xl border border-[var(--line)] bg-[var(--background)]/50 p-3"
            >
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--foreground)]">
                {title}
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/[0.035] p-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Ninzo Versus is an independently developed platform. Do not
            interpret this page as a claim that Ninzo Versus is licensed,
            registered, certified, regulated, or affiliated with a government,
            company, or other organization unless explicitly stated by Ninzo
            Versus.
          </p>
        </div>
      </>
    ),
  },
];

function SectionCard({ section }: { section: (typeof sections)[number] }) {
  return (
    <Card className="group relative overflow-hidden border-[var(--line)] bg-[var(--card)]/90 p-0 shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:bg-[var(--card)]">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--accent)]/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="grid sm:grid-cols-[88px_1fr]">
        <div className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-4 sm:border-b-0 sm:border-r sm:px-4 sm:py-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.06] text-xs font-black tracking-wider text-[var(--accent)]">
            {section.number}
          </div>
          <div className="pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)] sm:hidden">
            {section.label}
          </div>
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-full border border-[var(--line)] bg-black/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)] sm:inline-flex">
              {section.label}
            </span>
            <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
              {section.title}
            </h2>
          </div>

          <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--muted)]">
            {section.children}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function CompetitionPolicyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-[-240px] h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-[var(--accent)]/10 blur-[130px]" />
        <div className="absolute right-[-180px] top-[260px] h-[340px] w-[340px] rounded-full bg-[var(--accent-2)]/7 blur-[110px]" />
        <div className="absolute left-[-180px] top-[780px] h-[320px] w-[320px] rounded-full bg-[var(--accent)]/[0.045] blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,var(--foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--foreground)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <header className="relative mb-10 overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--card)]/70 p-5 backdrop-blur-sm sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 h-36 w-36 rotate-12 rounded-3xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.025]"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 left-1/3 h-32 w-32 rounded-full border border-[var(--accent-2)]/15"
          />

          <div className="relative">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="h-px w-7 bg-[var(--accent)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                  Ninzo Versus / Rulebook
                </p>
              </div>
              <span className="rounded-full border border-[var(--line)] bg-[var(--background)]/60 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                Independent Platform
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-[-0.03em] text-[var(--foreground)] sm:text-6xl">
                Competition
                <span className="block text-[var(--accent-2)]">
                  Rules & Policies
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                The core rules for competitions, participation, rewards, NV
                Tokens, player showcases, and platform features on Ninzo Versus.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                    Skill
                  </span>
                </div>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Results depend on performance and the rules published for the
                  competition.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-2)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-2)]">
                    Showcase
                  </span>
                </div>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Profiles, ranks, achievements, and other features help players
                  present their competitive identity.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--foreground)]">
                    Digital
                  </span>
                </div>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  NV Tokens and digital items are used for defined platform
                  features and benefits.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-5 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
              The rules
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Know the framework before you compete.
            </h2>
          </div>
          <div className="hidden text-right text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] sm:block">
            09 sections
          </div>
        </div>

        <div className="grid gap-4">
          {sections.map((section) => (
            <SectionCard key={section.number} section={section} />
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-5 sm:p-6">
          <div className="flex gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.06] text-xs font-black text-[var(--accent)]">
              i
            </div>

            <div>
              <h2 className="font-bold text-[var(--foreground)]">
                Participation agreement
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                By participating in a Ninzo Versus competition or using
                competition features, you agree to follow the applicable
                competition rules, tournament rules, result-review process,
                community standards, and organizer decisions.
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

        <div className="mt-7 flex flex-col gap-3 border-t border-[var(--line)] px-1 pt-5 text-center text-xs leading-5 text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            Ninzo Versus may update its competition rules, digital features, and
            platform policies as the platform evolves.
          </p>
          <p className="shrink-0 font-medium text-[var(--foreground)]/70">
            Rules for a specific event are presented before participation where
            applicable.
          </p>
        </div>
      </section>
    </main>
  );
}
