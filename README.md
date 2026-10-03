# Ninzo Versus

Ninzo Versus is a skill-based esports platform for Free Fire players in India. It features competitive 1v1 challenges, hosted events, and daily free esports tournaments.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Local development dummy users

While running `npm run dev` on localhost, open `/dev/seed` to create or update
dummy ranking users with a display name, IGN, matches played, and wins. Seeded
users are identified by a reserved development email, and only their four
ranking fields can be updated through this tool. Real users and match records
are not modified or created. Dummy counters are read from the user document and
appear alongside the active season's rankings. The page and its write action
are disabled outside localhost development.

## Commands

```bash
npm run lint
npm run build
```

## Monthly seasons

Rankings and completed Full Map results use UTC calendar-month seasons. During
the active month, rankings use each player's current account wins and matches.
At 23:59 UTC on the last calendar day, the scheduled snapshot copies those
counters and player names into that month's season records. Completed-month
rankings read only those saved records, so later matches and profile changes do
not change the archived standings. Settled matches also update their
settlement month's live statistics while it remains open, and monthly
inactivity counters start fresh with each new season.

After deploying the season fields, run `npm run db:backfill-monthly-seasons`
once to create historical season records, assign existing matches and hosted
events to their month, and backfill monthly player statistics from settled
matches. The backfill also preserves a one-time legacy counter snapshot for
older installations. It is safe to rerun and does not delete historical data.

The month-end standings snapshot is invoked by the
`/api/cron/snapshot-rankings` Vercel cron on days 28–31. It checks that the
current UTC day is the month's final day and is safe to retry after a successful
snapshot.

## Daily match stats cron

Vercel invokes `/api/cron/daily-match-stats` once at the start of every UTC
day. Players with a previous settled match receive a `+1 matchesPlayed`
inactivity increment after a full UTC day without a settled challenge. The
increment applies to lifetime stats and the current month's stats; per-player
UTC-day markers prevent duplicate increments when a scheduled invocation is
retried. A local `next dev` server does not run Vercel crons automatically.

To reset today's idempotency markers and run the increment manually from
PowerShell while `npm run dev` is running:

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/cron/daily-match-stats/reset
$run = Invoke-RestMethod -Method Get http://localhost:3000/api/cron/daily-match-stats
$run | ConvertTo-Json
```

In local development only, `POST /api/cron/daily-match-stats/reset` clears
today's daily-match-stats idempotency markers without changing counters. Calling
the normal cron endpoint afterward applies the increment again to eligible
players. The reset endpoint returns `404` in production.

## Product language

Public UI describes NV Tokens as match-entry inventory. It uses competitive-esports terminology: match registration, organizer-verified results, and reward redemption. See `/competition-policy` for the published rules.

## SEO

Public pages use metadata, semantic landmarks, structured data, `sitemap.xml`, and `robots.txt`. Authenticated competition pages are intentionally excluded from indexing.
