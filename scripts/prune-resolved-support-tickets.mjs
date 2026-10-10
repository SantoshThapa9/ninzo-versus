import { del } from "@vercel/blob";
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
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
const execute = process.argv.includes("--confirm");
if (execute && !process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error("BLOB_READ_WRITE_TOKEN is required to delete linked evidence.");
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  const tickets = db.collection("supporttickets");
  const messages = db.collection("supportmessages");
  const evidence = db.collection("supportevidences");
  const resolvedCount = await tickets.countDocuments({ status: "resolved" });
  if (!execute) {
    console.log(
      `Dry run: ${resolvedCount} resolved tickets and their linked messages, ` +
        `evidence records, and uploaded files are eligible for deletion. ` +
        "Pass --confirm to delete them.",
    );
  } else {
    const cursor = tickets.find(
      { status: "resolved" },
      { projection: { _id: 1 }, batchSize: 50 },
    );
    let ticketIds = [];
    let deletedTickets = 0;
    let deletedMessages = 0;
    let deletedEvidence = 0;

    async function purgeBatch(ids) {
      if (!ids.length) return;
      const batchEvidence = await evidence
        .find({ ticketId: { $in: ids } }, { projection: { _id: 1, blobPathname: 1 } })
        .toArray();
      for (const item of batchEvidence) {
        await del(item.blobPathname, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        await evidence.deleteOne({ _id: item._id });
        deletedEvidence += 1;
      }
      const session = client.startSession();
      let messageResult;
      let ticketResult;
      try {
        await session.withTransaction(async () => {
          messageResult = await messages.deleteMany(
            { ticketId: { $in: ids } },
            { session },
          );
          ticketResult = await tickets.deleteMany(
            { _id: { $in: ids }, status: "resolved" },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      deletedMessages += messageResult.deletedCount;
      deletedTickets += ticketResult.deletedCount;
    }

    for await (const ticket of cursor) {
      ticketIds.push(ticket._id);
      if (ticketIds.length === 50) {
        await purgeBatch(ticketIds);
        ticketIds = [];
      }
    }
    await purgeBatch(ticketIds);
    console.log(
      `Deleted ${deletedTickets} resolved tickets, ${deletedMessages} messages, ` +
        `and ${deletedEvidence} evidence records and uploaded files.`,
    );
  }
} finally {
  await client.close();
}
