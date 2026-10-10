# Ninzo Versus

Ninzo Versus is a skill-based esports platform for Free Fire players in India. It features competitive 1v1 challenges, hosted events, and daily free esports tournaments.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Commands

```bash
npm run lint
npm run build
```

Before deploying the shared profile cooldown, run
`npm run db:migrate-profile-update-timestamp` to consolidate the old profile
and payment cooldowns into `users.updatedAt` and `users.paymentDetailUpdateAt`,
then remove the old timestamp fields.

## Monthly seasons

Rankings and completed Full Map results use UTC calendar-month seasons. During
the active month, rankings use each player's current account wins and matches.
Completed-month rankings read saved season records, so later matches and
profile changes do not change the archived standings.

The `seasonplayerstats` collection stores only finalized month-end snapshots.
Live rankings use account counters, and rollover snapshots are rebuilt from
settled matches. To remove rows left by the old live-write behavior while
preserving finalized snapshots, run:

```bash
npm run db:prune-live-season-stats -- --confirm
```

The monthly standings snapshot runs at 00:01 UTC on the first day of each
month. It saves the previous month's final rankings, awards 10 NV tokens to
each of the top 10 players, and resets monthly match and win counters. Rank
Score is calculated from settled 1v1 results: wins add 10 points and losses
subtract 5 points.

Settled and disqualified matches expire from MongoDB three days after
`completedAt`. Disputed matches awaiting admin review are retained until an
admin settles them. Install the TTL index in an existing database with:

```bash
npm run db:ensure-match-ttl-index -- --confirm
```

Installing the index also makes already-expired settled/cancelled matches
eligible for deletion based on their existing `completedAt` timestamps.

## Product language

Public UI describes NV Tokens as match-entry inventory. It uses competitive-esports terminology: match registration, organizer-verified results, and reward redemption. See `/competition-policy` for the published rules.

## SEO

Public pages use metadata, semantic landmarks, structured data, `sitemap.xml`, and `robots.txt`. Authenticated competition pages are intentionally excluded from indexing.
