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
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const asNumericString = (field) => ({
  $cond: [
    { $eq: [{ $type: `$${field}` }, "missing"] },
    "0",
    {
      $cond: [
        { $in: [{ $type: `$${field}` }, ["int", "long", "double", "decimal"]] },
        { $toString: `$${field}` },
        `$${field}`,
      ],
    },
  ],
});

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const result = await client.db().collection("users").updateMany({}, [
    {
      $set: {
        matchesPlayed: asNumericString("matchesPlayed"),
        wins: asNumericString("wins"),
      },
    },
  ]);
  console.log(`Converted ${result.modifiedCount} user match-stat documents.`);
} finally {
  await client.close();
}
