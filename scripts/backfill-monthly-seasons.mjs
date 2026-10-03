import { MongoClient, ObjectId } from "mongodb";
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
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

function seasonForDate(date) {
  const startDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const nextMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  );
  const month = startDate.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const year = startDate.getUTCFullYear();
  const slug = `${month.toLowerCase()}-${year}`;
  const now = new Date();
  const active =
    startDate.getUTCFullYear() === now.getUTCFullYear() &&
    startDate.getUTCMonth() === now.getUTCMonth();

  return {
    id: slug,
    slug,
    name: `${month} ${year}`,
    startDate,
    endDate: new Date(nextMonth.getTime() - 1),
    status: active ? "active" : "completed",
  };
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  const seasons = db.collection("seasons");
  const seasonIds = new Map();

  async function getSeasonId(date) {
    const season = seasonForDate(date);
    let seasonId = seasonIds.get(season.slug);
    if (seasonId) return seasonId;

    seasonId = new ObjectId();
    await seasons.updateOne(
      { slug: season.slug },
      { $setOnInsert: { _id: seasonId, ...season } },
      { upsert: true },
    );
    const existing = await seasons.findOne(
      { slug: season.slug },
      { projection: { _id: 1 } },
    );
    if (!existing) throw new Error(`Unable to create season ${season.slug}.`);
    seasonIds.set(season.slug, existing._id);
    return existing._id;
  }

  await getSeasonId(new Date());

  async function backfill(collectionName, dateForRecord) {
    const collection = db.collection(collectionName);
    const cursor = collection.find({});
    let operations = [];
    let modified = 0;

    for await (const record of cursor) {
      const date = dateForRecord(record);
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error(`Invalid season date in ${collectionName}/${record._id}.`);
      }
      const seasonId = await getSeasonId(date);
      operations.push({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { seasonId } },
        },
      });
      if (operations.length === 500) {
        const result = await collection.bulkWrite(operations, { ordered: false });
        modified += result.modifiedCount;
        operations = [];
      }
    }

    if (operations.length) {
      const result = await collection.bulkWrite(operations, { ordered: false });
      modified += result.modifiedCount;
    }
    console.log(`Backfilled ${modified} ${collectionName} records.`);
  }

  await backfill(
    "matches",
    (match) => match.completedAt ?? match.createdAt,
  );
  await backfill("hostedevents", (event) => event.eventDate);
} finally {
  await client.close();
}
