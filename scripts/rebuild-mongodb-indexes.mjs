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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();
if (process.env.CONFIRM_INDEX_REBUILD !== "clear-data-first") {
  throw new Error("This only runs after manually clearing Atlas data. Set CONFIRM_INDEX_REBUILD=clear-data-first.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const indexes = {
  users: [[{ email: 1 }, { unique: true }], [{ role: 1 }, {}]],
  playerprofiles: [[{ userId: 1 }, { unique: true }]],
  matches: [[{ status: 1, createdAt: -1 }, {}], [{ creatorId: 1, status: 1 }, {}], [{ seasonId: 1, status: 1, completedAt: -1 }, {}]],
  matchparticipants: [[{ matchId: 1, userId: 1 }, { unique: true }], [{ userId: 1, matchId: 1 }, {}]],
  matchchatmessages: [[{ matchId: 1, createdAt: 1 }, {}], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  cointransactions: [[{ idempotencyKey: 1 }, { unique: true }], [{ userId: 1, createdAt: -1 }, {}]],
  withdrawals: [[{ userId: 1, createdAt: -1 }, {}], [{ status: 1, createdAt: -1 }, {}]],
  payments: [[{ razorpayOrderId: 1 }, { unique: true }], [{ razorpayPaymentId: 1 }, { unique: true, sparse: true }], [{ idempotencyKey: 1 }, { unique: true }]],
  supporttickets: [[{ userId: 1, updatedAt: -1 }, {}], [{ status: 1, updatedAt: -1 }, {}]],
  supportmessages: [[{ ticketId: 1, createdAt: 1 }, {}]],
  supportevidences: [[{ expiresAt: 1 }, {}]],
  resultsubmissions: [[{ matchId: 1, userId: 1, kind: 1 }, { unique: true }], [{ expiresAt: 1 }, {}]],
  matchevidenceattempts: [[{ matchId: 1, userId: 1 }, {}]],
  auditlogs: [[{ createdAt: -1 }, {}]],
  disputes: [[{ status: 1, createdAt: -1 }, {}]],
  hostedevents: [[{ status: 1, eventDate: 1 }, {}], [{ status: 1, registrationClosesAt: 1 }, {}], [{ seasonId: 1, status: 1, eventDate: -1 }, {}]],
  seasons: [[{ slug: 1 }, { unique: true }], [{ startDate: -1 }, {}]],
  seasonplayerstats: [[{ seasonId: 1, wins: -1, matchesPlayed: -1 }, {}]],
  hostedteams: [[{ eventId: 1, captainId: 1 }, { unique: true }], [{ eventId: 1, slotNumber: 1 }, { unique: true }]],
  verifiedroomids: [[{ roomId: 1 }, { unique: true }]],
  aiconfigurations: [[{ key: 1 }, { unique: true }]],
};

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  for (const [name, definitions] of Object.entries(indexes)) {
    const collection = db.collection(name);
    if ((await collection.estimatedDocumentCount()) !== 0) {
      throw new Error(`${name} is not empty; refusing to alter its indexes.`);
    }
    const existing = await collection.indexes().catch(() => []);
    await Promise.all(existing.filter((index) => index.name !== "_id_").map((index) => collection.dropIndex(index.name)));
    await Promise.all(definitions.map(([keys, options]) => collection.createIndex(keys, options)));
    console.log(`Rebuilt ${name}.`);
  }
} finally {
  await client.close();
}
