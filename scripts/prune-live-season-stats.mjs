import { MongoClient } from "mongodb";
import { readFile } from "node:fs/promises";

async function loadLocalEnv() {
  try {
    const contents = await readFile(".env.local", "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();
if (!process.argv.includes("--confirm")) {
  throw new Error(
    "Pass --confirm to remove stats for seasons without a finalized month-end snapshot.",
  );
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  const snapshottedSeasons = await db
    .collection("seasons")
    .find({ rankingsSnapshottedAt: { $exists: true } })
    .project({ _id: 1 })
    .toArray();
  const seasonIds = snapshottedSeasons.map(({ _id }) => _id);
  const result = await db
    .collection("seasonplayerstats")
    .deleteMany({ seasonId: { $nin: seasonIds } });
  console.log(
    `Removed ${result.deletedCount} stats outside finalized month-end snapshots.`,
  );
} finally {
  await client.close();
}
