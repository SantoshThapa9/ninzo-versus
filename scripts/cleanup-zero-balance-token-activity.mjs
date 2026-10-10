import { MongoClient } from "mongodb";
import { readFile } from "node:fs/promises";

const LEGACY_IDEMPOTENCY_COLLECTION = "coin_transaction_idempotency";
const IDEMPOTENCY_COLLECTION = "cointransactionidempotencykeys";
const BATCH_SIZE = 500;

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

function markerFrom(transaction) {
  if (typeof transaction.idempotencyKey !== "string" || !transaction.idempotencyKey) {
    throw new Error("Cannot preserve idempotency: token activity document has no idempotency key.");
  }
  if (transaction.referenceType !== "daily_free_reward") {
    return { idempotencyKey: transaction.idempotencyKey };
  }

  for (const field of ["userId", "type", "amount", "referenceId"]) {
    if (transaction[field] === undefined || transaction[field] === null) {
      throw new Error(`Cannot preserve daily-reward idempotency: token activity document is missing ${field}.`);
    }
  }
  const rewardDay = transaction.metadata?.rewardDay;
  return {
    idempotencyKey: transaction.idempotencyKey,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    ...(typeof rewardDay === "number" ? { metadata: { rewardDay } } : {}),
  };
}

function markerUpsert(marker) {
  return {
    updateOne: {
      filter: { idempotencyKey: marker.idempotencyKey },
      update: { $setOnInsert: marker },
      upsert: true,
    },
  };
}

async function collectionExists(db, name) {
  return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function reportIndexes(collection) {
  const indexes = await collection.listIndexes().toArray().catch((error) => {
    if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  console.log(
    `${collection.collectionName} indexes: ${JSON.stringify(
      indexes.map(({ name, key, unique, partialFilterExpression }) => ({
        name,
        key,
        ...(unique ? { unique } : {}),
        ...(partialFilterExpression ? { partialFilterExpression } : {}),
      })),
    )}`,
  );
  return indexes;
}

async function ensureIndex(collection, key, options) {
  await collection.createIndex(key, options);
}

await loadLocalEnv();
if (!process.argv.includes("--confirm")) {
  throw new Error("Pass --confirm to permanently delete zero-balance token activity.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  for (const name of ["users", "cointransactions"]) {
    if (!(await collectionExists(db, name))) {
      throw new Error(`Required collection ${name} does not exist; refusing to run the cleanup.`);
    }
  }

  const users = db.collection("users");
  const activities = db.collection("cointransactions");
  const idempotencyKeys = db.collection(IDEMPOTENCY_COLLECTION);
  const legacyIdempotencyExists = await collectionExists(db, LEGACY_IDEMPOTENCY_COLLECTION);
  const legacyIdempotency = legacyIdempotencyExists
    ? db.collection(LEGACY_IDEMPOTENCY_COLLECTION)
    : null;

  await reportIndexes(users);
  await reportIndexes(activities);
  await reportIndexes(idempotencyKeys);
  if (legacyIdempotency) await reportIndexes(legacyIdempotency);

  await ensureIndex(activities, { idempotencyKey: 1 }, {
    unique: true,
    name: "idempotencyKey_1",
  });
  await ensureIndex(activities, { userId: 1, createdAt: -1 }, {
    name: "userId_1_createdAt_-1",
  });
  await ensureIndex(activities, { userId: 1, referenceType: 1, referenceId: 1 }, {
    unique: true,
    partialFilterExpression: { referenceType: "daily_free_reward" },
    name: "userId_1_referenceType_1_referenceId_1",
  });
  await ensureIndex(activities, { accountEmail: 1, referenceType: 1, referenceId: 1 }, {
    unique: true,
    partialFilterExpression: {
      referenceType: "daily_free_reward",
      accountEmail: { $type: "string" },
    },
    name: "accountEmail_1_referenceType_1_referenceId_1",
  });
  await ensureIndex(idempotencyKeys, { idempotencyKey: 1 }, {
    unique: true,
    name: "idempotencyKey_1",
  });
  await ensureIndex(idempotencyKeys, { userId: 1, referenceType: 1, referenceId: 1 }, {
    unique: true,
    partialFilterExpression: { referenceType: "daily_free_reward" },
    name: "userId_1_referenceType_1_referenceId_1",
  });
  await reportIndexes(activities);
  await reportIndexes(idempotencyKeys);

  let migratedLegacyMarkers = 0;
  if (legacyIdempotency) {
    let operations = [];
    for await (const transaction of legacyIdempotency.find({}).batchSize(BATCH_SIZE)) {
      operations.push(markerUpsert(markerFrom(transaction)));
      if (operations.length === BATCH_SIZE) {
        await idempotencyKeys.bulkWrite(operations, { ordered: false });
        migratedLegacyMarkers += operations.length;
        operations = [];
      }
    }
    if (operations.length > 0) {
      await idempotencyKeys.bulkWrite(operations, { ordered: false });
      migratedLegacyMarkers += operations.length;
    }
  }

  const zeroBalanceFilter = {
    availableCoins: 0,
    lockedCoins: 0,
    role: { $ne: "platform" },
  };
  const candidateCount = await users.countDocuments(zeroBalanceFilter);
  let cleanedUsers = 0;
  let skippedChangedUsers = 0;
  let deletedActivityCount = 0;
  const session = client.startSession();
  try {
    for await (const user of users.find(zeroBalanceFilter).project({ _id: 1 }).batchSize(BATCH_SIZE)) {
      let deletedForUser = 0;
      let wasStillEligible = false;
      await session.withTransaction(async () => {
        deletedForUser = 0;
        wasStillEligible = false;
        const lockResult = await users.updateOne(
          { _id: user._id, ...zeroBalanceFilter },
          { $set: { _tokenActivityCleanupLock: true } },
          { session },
        );
        if (lockResult.matchedCount === 0) return;
        wasStillEligible = true;

        const transactions = await activities.find({ userId: user._id }, { session })
          .project({
            userId: 1,
            type: 1,
            amount: 1,
            referenceType: 1,
            referenceId: 1,
            idempotencyKey: 1,
            metadata: 1,
          })
          .toArray();
        if (transactions.length > 0) {
          const markers = transactions.map((transaction) => markerUpsert(markerFrom(transaction)));
          await idempotencyKeys.bulkWrite(markers, { session, ordered: false });
          const result = await activities.deleteMany({ userId: user._id }, { session });
          if (result.deletedCount !== transactions.length) {
            throw new Error(`Token activity count changed during cleanup for user ${user._id}.`);
          }
          deletedForUser = result.deletedCount;
        }

        await users.updateOne(
          { _id: user._id, _tokenActivityCleanupLock: true },
          { $unset: { _tokenActivityCleanupLock: "" } },
          { session },
        );
      });
      if (wasStillEligible) cleanedUsers += 1;
      else skippedChangedUsers += 1;
      deletedActivityCount += deletedForUser;
    }
  } finally {
    await session.endSession();
  }

  let droppedLegacyCollection = false;
  if (legacyIdempotency && (await collectionExists(db, LEGACY_IDEMPOTENCY_COLLECTION))) {
    await legacyIdempotency.drop();
    droppedLegacyCollection = true;
  }

  console.log(
    `Cleaned ${deletedActivityCount} token activity documents for ${cleanedUsers}/${candidateCount} zero-balance non-platform users; skipped ${skippedChangedUsers} whose balance changed during migration. Preserved ${migratedLegacyMarkers} legacy idempotency markers. Legacy activity archive dropped: ${droppedLegacyCollection}.`,
  );
} finally {
  await client.close();
}
