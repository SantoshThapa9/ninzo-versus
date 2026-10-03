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
appear alongside season-filtered match rankings. The page and its write action
are disabled outside localhost development.

## Commands

```bash
npm run lint
npm run build
```

## Monthly seasons

Rankings and completed Full Map results use UTC calendar-month seasons. After
deploying the season fields, run `npm run db:backfill-monthly-seasons` once to
create historical season records and assign existing matches and hosted events
to their month. The backfill is safe to rerun and does not delete historical
data.

## Daily match stats cron

Vercel invokes `/api/cron/daily-match-stats` once at the start of every UTC
day. The job's per-player UTC-day marker prevents duplicate increments if a
scheduled invocation is retried. A local `next dev` server does not run Vercel
crons automatically; the authenticated endpoint can be called manually for
testing when needed.

In local development only, `POST /api/cron/daily-match-stats/reset` clears
today's daily-match-stats idempotency markers without changing any match
counters. Call the normal cron endpoint afterwards to exercise its usual
`+1 matchesPlayed` flow again. The reset endpoint returns `404` in production.

## Product language

Public UI describes NV Tokens as match-entry inventory. It uses competitive-esports terminology: match registration, organizer-verified results, and reward redemption. See `/competition-policy` for the published rules.

## SEO

Public pages use metadata, semantic landmarks, structured data, `sitemap.xml`, and `robots.txt`. Authenticated competition pages are intentionally excluded from indexing.
