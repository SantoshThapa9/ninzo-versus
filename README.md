# Ninzo Versus

Ninzo Versus is a skill-based esports platform for Free Fire players in India. It features competitive 1v1 challenges, hosted events, and daily free esports tournaments.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Android development with Capacitor

The Android debug app loads the running Next.js development server. This keeps
server-rendered pages, API routes, authentication, and the existing production
website configuration intact; the APK is a development shell and is not
standalone or usable when the development server is stopped. Do not put API
keys or other secrets in `CAPACITOR_SERVER_URL`; it is only the local server
address.

### One-time setup

1. Install Android Studio and its Android SDK, then install the project
   dependencies:

   ```bash
   npm install
   ```

2. Generate the native Android project once:

   ```bash
   npx cap add android
   ```

3. Connect the Android phone and PC to the same phone hotspot. On the PC, run
   `ipconfig` and note the IPv4 address on the hotspot-connected network
   adapter. Use that PC address (not the phone's address) in the next steps.

### Start live reload and run on a phone

1. In a PowerShell terminal at the project root, set the address to the PC's
   hotspot IPv4 address and start Next.js:

   ```powershell
   $env:CAPACITOR_SERVER_URL = "http://192.168.43.123:3000"
   npm run dev
   ```

   Replace `192.168.43.123` with the address found using `ipconfig`. Keep this
   terminal running. If Windows Firewall asks, allow Node.js on private
   networks.

2. In a second PowerShell terminal, set the same address and sync the Android
   project:

   ```powershell
   $env:CAPACITOR_SERVER_URL = "http://192.168.43.123:3000"
   npm run android:sync
   npm run android:open
   ```

   Sync embeds only the local server URL in the debug Android configuration.
   It does not change the Next.js production build or deploy any secrets.

3. In Android Studio, open the generated `android` folder if it did not open
   automatically: choose **File > Open**, select this project's `android`
   folder, and wait for Gradle sync to finish.

4. On Android 11 or later, enable **Developer options > Wireless debugging**.
   In Android Studio, choose **Pair Devices Using Wi-Fi** (the device picker
   or **Device Manager**), scan the pairing QR code or enter the pairing code
   shown on the phone, and select the paired device as the run target. The PC
   and phone must remain on the same hotspot network.

5. Click **Run** in Android Studio. The app opens the live Next.js site; edits
   saved in VS Code are picked up by Next.js Fast Refresh while `npm run dev`
   remains running. To build a debug APK, choose **Build > Build Bundle(s) /
   APK(s) > Build APK(s)** in Android Studio. The APK is created under
   `android/app/build/outputs/apk/debug/`.

If the hotspot assigns the PC a different IPv4 address, update
`CAPACITOR_SERVER_URL`, run `npm run android:sync` again, and reinstall/run the
debug app. For Android versions without Wireless debugging, connect by USB and
enable USB debugging in Developer options.

### Build an APK for the deployed website

The full Next.js app uses server rendering, authentication cookies, server
actions, and request-dependent API routes. It cannot be bundled as a fully
offline static Android app without replacing those server features. Instead,
the production APK opens the deployed HTTPS website in its WebView. The website
continues to provide SSR and its existing APIs; the phone needs internet access,
but does not need your PC or development server. This does not change the
website's deployment configuration or place server secrets in the APK.

Set `CAPACITOR_PRODUCTION_URL` to the deployed website origin (currently
`https://ninzo-versus.vercel.app`), sync, and build a sideloadable debug-signed
APK:

```powershell
$env:CAPACITOR_PRODUCTION_URL = "https://ninzo-versus.vercel.app"
npm run android:sync
.\android\gradlew.bat -p .\android assembleDebug
Remove-Item Env:CAPACITOR_PRODUCTION_URL
```

The APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`. Do not set
`CAPACITOR_SERVER_URL` for this build; that variable remains available for the
development live-reload workflow above. The two URL variables cannot be set at
the same time. Install the APK on a phone with internet access, open it, and

On Android, Google sign-in opens a Chrome Custom Tab instead of embedding
Google's OAuth page in the app WebView. After Google's existing web OAuth
callback completes, a short-lived, single-use, PKCE-bound handoff returns to
the app and creates the normal Auth.js session in its WebView. Keep the Google
OAuth client configured as a **Web application** with the deployed website's
existing authorized origin and `/api/auth/callback/google` redirect URI; this
flow does not require a separate Android OAuth client. Do not place OAuth
secrets in Capacitor configuration or the APK. Website Google sign-in continues
to use the existing Auth.js redirect flow. Install the APK on a phone with internet access, open it, and
test sign-in, navigation, and server-backed features such as deposits against
the deployed site. This debug-signed APK is for direct testing, not Play Store
distribution; Play Store release signing requires your release keystore.

## Cashfree token deposits

Set `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET` in the server environment.
Set `CASHFREE_ENV=sandbox` for test credentials or `CASHFREE_ENV=production`
for live credentials. If omitted, the environment is inferred from the client
ID prefix. Configure the Cashfree payment webhook to call
`/api/payments/cashfree/webhook` and subscribe to successful payment events.
Players must be at least 18 and have a phone number saved in their profile to
make a deposit.

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
