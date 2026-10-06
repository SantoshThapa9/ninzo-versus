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

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  const users = db.collection("users");
  const profiles = db.collection("playerprofiles");
  const profileTimestamps = new Map();
  const profileCursor = profiles.find(
    { identityUpdatedAt: { $type: "date" } },
    { projection: { userId: 1, identityUpdatedAt: 1 } },
  );
  for await (const profile of profileCursor) {
    const userId = String(profile.userId);
    const current = profileTimestamps.get(userId);
    if (!current || profile.identityUpdatedAt > current) {
      profileTimestamps.set(userId, profile.identityUpdatedAt);
    }
  }

  let operations = [];
  let migrated = 0;
  const userCursor = users.find(
    {},
    {
      projection: {
        displayNameUpdatedAt: 1,
        ageChangedAt: 1,
        paymentDetailsChangedAt: 1,
        ageUpdatedAt: 1,
        payoutDetailsUpdatedAt: 1,
        profileUpdateAt: 1,
        paymentDetailUpdateAt: 1,
        updatedAt: 1,
      },
    },
  );
  for await (const user of userCursor) {
    const timestamps = [
      user.updatedAt,
      user.profileUpdateAt,
      user.displayNameUpdatedAt,
      user.ageChangedAt,
      user.ageUpdatedAt,
      profileTimestamps.get(String(user._id)),
    ].filter((value) => value instanceof Date);
    const latestProfileUpdate = timestamps.reduce(
      (current, value) => (value > current ? value : current),
      new Date(0),
    );
    const paymentTimestamps = [
      user.paymentDetailUpdateAt,
      user.paymentDetailsChangedAt,
      user.payoutDetailsUpdatedAt,
    ].filter((value) => value instanceof Date);
    const latestPaymentUpdate = paymentTimestamps.reduce(
      (current, value) => (value > current ? value : current),
      new Date(0),
    );
    const update = {
      $unset: {
        displayNameUpdatedAt: "",
        ageChangedAt: "",
        paymentDetailsChangedAt: "",
        ageUpdatedAt: "",
        payoutDetailsUpdatedAt: "",
        adultConfirmationAt: "",
        isAdultConfirmed: "",
        profileUpdateAt: "",
      },
    };
    update.$set = {};
    if (latestProfileUpdate.getTime() > 0) {
      update.$set.updatedAt = latestProfileUpdate;
    }
    if (latestPaymentUpdate.getTime() > 0) {
      update.$set.paymentDetailUpdateAt = latestPaymentUpdate;
    }
    if (Object.keys(update.$set).length === 0) delete update.$set;
    operations.push({ updateOne: { filter: { _id: user._id }, update } });
    migrated++;
    if (operations.length === 500) {
      await users.bulkWrite(operations);
      operations = [];
    }
  }
  if (operations.length) await users.bulkWrite(operations);
  const removedIdentityTimestamps = await profiles.updateMany(
    { identityUpdatedAt: { $exists: true } },
    { $unset: { identityUpdatedAt: "" } },
  );
  console.log(
    `Consolidated profile and payment timestamps for ${migrated} users; removed identity timestamps from ${removedIdentityTimestamps.modifiedCount} player profiles.`,
  );
} finally {
  await client.close();
}
