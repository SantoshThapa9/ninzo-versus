import { MongoClient, ObjectId } from "mongodb";
import { readFile } from "node:fs/promises";

const BATCH_SIZE = 500;
const ACTIVITY_COLLECTION = "cointransactions";
const AUDIT_COLLECTION = "tokenactivityaudits";

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

async function collectionExists(db, name) {
  return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function auditRecord(transaction, previousBalance, matches, matchCache) {
  const availableAfter = transaction.availableAfter;
  const lockedAfter = transaction.lockedAfter;
  const availableDelta = previousBalance
    ? availableAfter - previousBalance.availableAfter
    : transaction.amount;
  const lockedDelta = previousBalance
    ? lockedAfter - previousBalance.lockedAfter
    : transaction.type === "stake_lock"
      ? -transaction.amount
      : 0;
  const availableBefore = availableAfter - availableDelta;
  const lockedBefore = lockedAfter - lockedDelta;
  const record = {
    _id: transaction._id,
    transactionId: transaction._id,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    availableDelta,
    lockedDelta,
    availableBefore,
    lockedBefore,
    availableAfter,
    lockedAfter,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    createdAt: transaction.createdAt,
  };

  if (transaction.type === "stake_settle") {
    let outcome = transaction.metadata?.outcome;
    if (!["win", "loss", "draw"].includes(outcome)) {
      const matchId = String(transaction.referenceId);
      let match = matchCache.get(matchId);
      if (match === undefined) {
        match = await matches.findOne(
          { _id: new ObjectId(String(transaction.referenceId)) },
          { projection: { winnerTeam: 1, creatorId: 1, opponentCaptainId: 1 } },
        );
        matchCache.set(matchId, match ?? null);
      }
      if (match?.winnerTeam === null) {
        outcome = "draw";
      } else if (match?.winnerTeam === "A" || match?.winnerTeam === "B") {
        const isCreator = String(match.creatorId) === String(transaction.userId);
        const isOpponent = String(match.opponentCaptainId) === String(transaction.userId);
        if (isCreator || isOpponent) {
          const isWinner =
            (match.winnerTeam === "A" && isCreator) ||
            (match.winnerTeam === "B" && isOpponent);
          outcome = isWinner ? "win" : "loss";
        }
      }
    }
    if (["win", "loss", "draw"].includes(outcome)) record.matchOutcome = outcome;
  }
  if (transaction.type === "withdrawal" && transaction.referenceType === "Withdrawal") {
    record.withdrawalSnapshot = {
      requestedAmount: Math.abs(transaction.amount),
      availableBeforeReservation: availableBefore,
      lockedBeforeReservation: lockedBefore,
      totalBeforeReservation: availableBefore + lockedBefore,
      availableAfterReservation: availableAfter,
      lockedAfterReservation: lockedAfter,
      totalAfterReservation: availableAfter + lockedAfter,
    };
  }
  return record;
}

await loadLocalEnv();
if (!process.argv.includes("--confirm")) {
  throw new Error("Pass --confirm to backfill permanent token activity audit records.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  for (const name of ["users", ACTIVITY_COLLECTION]) {
    if (!(await collectionExists(db, name))) {
      throw new Error(`Required collection ${name} does not exist; refusing to backfill.`);
    }
  }

  const activities = db.collection(ACTIVITY_COLLECTION);
  const matches = db.collection("matches");
  const platformUsers = await db.collection("users")
    .find({ role: "platform" })
    .project({ _id: 1 })
    .toArray();
  const platformUserIds = new Set(platformUsers.map(({ _id }) => String(_id)));
  const audits = db.collection(AUDIT_COLLECTION);
  await audits.createIndex({ userId: 1, transactionId: 1 }, { unique: true });
  await audits.createIndex({ userId: 1, createdAt: -1, _id: -1 });
  await audits.createIndex({ userId: 1, referenceType: 1, referenceId: 1 });
  await audits.createIndex({
    userId: 1,
    availableAfter: 1,
    lockedAfter: 1,
    createdAt: -1,
    _id: -1,
  });

  let previousUserId = null;
  let previousBalance = null;
  const matchCache = new Map();
  let operations = [];
  let scanned = 0;
  let inserted = 0;

  for await (const transaction of activities
    .find({})
    .sort({ userId: 1, createdAt: 1, _id: 1 })
    .batchSize(BATCH_SIZE)) {
    const userId = String(transaction.userId);
    if (platformUserIds.has(userId)) continue;
    if (userId !== previousUserId) {
      previousUserId = userId;
      previousBalance = null;
    }
    const record = await auditRecord(transaction, previousBalance, matches, matchCache);
    previousBalance = {
      availableAfter: transaction.availableAfter,
      lockedAfter: transaction.lockedAfter,
    };
    operations.push({
      updateOne: {
        filter: { transactionId: transaction._id },
        update: { $setOnInsert: record },
        upsert: true,
      },
    });
    scanned += 1;

    if (operations.length === BATCH_SIZE) {
      const result = await audits.bulkWrite(operations, { ordered: false });
      inserted += result.upsertedCount;
      operations = [];
    }
  }
  if (operations.length > 0) {
    const result = await audits.bulkWrite(operations, { ordered: false });
    inserted += result.upsertedCount;
  }

  console.log(`Scanned ${scanned} token activity rows; backfilled ${inserted} permanent audit records.`);
} finally {
  await client.close();
}
