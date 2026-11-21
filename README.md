# Ninzo Versus

**Ninzo Versus** is an online competitive gaming platform that connects players through player-created challenges and platform-hosted matches. Players can create or accept 1v1 challenges, join Full Map events, submit match evidence, and track monthly rankings.

[Live demo](https://ninzo-versus.vercel.app/)

## Screenshots

![Ninzo Versus home screen](https://santosh-gamma.vercel.app/projects/nv/1.webp)

![Ninzo Versus challenge experience](https://santosh-gamma.vercel.app/projects/nv/2.webp)

![Ninzo Versus rankings](https://santosh-gamma.vercel.app/projects/nv/3.webp)

## Tech stack

- React 19 and Next.js 16
- MongoDB with Mongoose
- NextAuth for credentials and Google sign-in

## Key features

- Create, publish, and accept competitive 1v1 challenges.
- Join organizer-hosted Full Map events and view published results.
- Submit match evidence, communicate in match chat, and resolve match outcomes.
- Track seasonal player rankings and event standings.

## Run locally

Requires Node.js 20.9 or later and a MongoDB database.

```bash
npm install
```

Create a `.env.local` file in the project root:

```env
# Required for the core app
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
AUTH_SECRET=<generate-a-long-random-secret>
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=<google-oauth-client-id>
AUTH_GOOGLE_SECRET=<google-oauth-client-secret>

# Optional integrations
REDIS_URL=rediss://default:<token>@<host>:6379
# Or use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
BLOB_READ_WRITE_TOKEN=<vercel-blob-token>
OPENAI_API_KEY=<openai-api-key>
CRON_SECRET=<cron-secret>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_SUBJECT=mailto:you@example.com
CASHFREE_CLIENT_ID=<cashfree-client-id>
CASHFREE_CLIENT_SECRET=<cashfree-client-secret>
CASHFREE_ENV=sandbox
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `npm run lint` to check code quality and `npm run build` to create a production build.
