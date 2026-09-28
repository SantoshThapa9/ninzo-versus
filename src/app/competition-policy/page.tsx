import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Competition Policy | Ninzo Versus",
  description:
    "Rules for skill-based gaming, daily free esports tournaments, competitive 1v1 challenges, and redeem gaming rewards.",
  alternates: { canonical: "/competition-policy" },
};

export default function CompetitionPolicyPage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">Ninzo Versus</p>
        <h1 className="mt-1 text-3xl font-extrabold">Competition Policy & Terms of Service</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Rules for skill-based gaming, competitive 1v1 challenges, and redeem gaming rewards.</p>
      </div>
      <Card>
        <h2 className="mb-2 text-lg font-bold">Skill-based esports</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Ninzo Versus hosts performance-based competitions. Match outcomes are determined by in-game performance, official results, and the published competition rules.</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-bold">Esports rewards and fulfillment</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Organizer-guaranteed rewards are performance-based, disclosed before play, verified against final results, and are not funded by player stakes.</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Eligible rewards are verified against official tournament results and fulfilled by the organizer. Post-match result verification and reward redemption may require tournament evidence and account details.</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-bold">NV Tokens and match entry</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Purchasing NV Tokens for Match Entry is the only Razorpay wording used on Ninzo Versus. NV Tokens support match registration and do not represent a transferable currency.</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Paid registrations remain paused until compliance approvals are complete.</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-bold">Free play options</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Free tournaments are genuinely free, allowing players to earn NV Tokens purely through skill without mandatory purchases. Check the tournament schedule for daily free esports tournaments.</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-bold">Items and participation</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Badges and participation items are non-transferable, non-redeemable, and cannot be used for tournament entry.</p>
      </Card>
      <p className="text-sm text-[var(--muted)]">By registering for a match, you agree to the published room rules, result review process, and organizer decisions. <Link className="text-[var(--accent-2)] underline" href="/support">Contact support</Link> for competition help.</p>
    </section>
  );
}
