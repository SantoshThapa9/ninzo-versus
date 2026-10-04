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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required. Add it to .env.local or your terminal environment.");

const client = new MongoClient(uri);
await client.connect();

try {
  const db = client.db();
  const profiles = db.collection("playerprofiles");
  const users = db.collection("users");
  const operations = [];
  let scanned = 0;

  for await (const profile of profiles.find({}, { projection: { userId: 1, ign: 1 } })) {
    scanned += 1;
    if (!profile.userId || !profile.ign) continue;
    operations.push({
      updateOne: {
        filter: { _id: profile.userId },
        update: { $set: { ign: profile.ign } },
      },
    });
  }

  const result = operations.length ? await users.bulkWrite(operations) : undefined;
  console.log(`Scanned ${scanned} player profiles.`);
  console.log(`Matched ${result?.matchedCount ?? 0} users; updated ${result?.modifiedCount ?? 0} user documents.`);
} finally {
  await client.close();
}
