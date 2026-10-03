import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { DEV_DUMMY_USER_EMAIL_PATTERN } from "@/lib/dev-dummy-users";
import { getSeasonPlayerStatId } from "@/lib/season-player-stat";
import { SeasonPlayerStatModel } from "@/models/season-player-stat";
import { UserModel } from "@/models/user";
import { getOrCreateSeasonForDate } from "@/services/season.service";
import { UserRole, UserStatus } from "@/types/enums";

const dummyUserInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(24),
    ign: z.string().trim().min(2).max(20),
    matchesPlayed: z.coerce.number().int().min(0),
    wins: z.coerce.number().int().min(0),
  })
  .refine((value) => value.wins <= value.matchesPlayed, {
    message: "Wins cannot be greater than matches played.",
    path: ["wins"],
  });

function getDummyUserEmail(ign: string) {
  const key = createHash("sha256")
    .update(ign.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `dummy+${key}@dev.invalid`;
}

export type DevDummyUser = {
  id: string;
  displayName: string;
  ign: string;
  matchesPlayed: string;
  wins: string;
};

function rankingFields(input: z.output<typeof dummyUserInputSchema>) {
  return {
    displayName: input.displayName,
    ign: input.ign,
    matchesPlayed: String(input.matchesPlayed),
    wins: String(input.wins),
  };
}

async function setCurrentSeasonStats(
  userId: string,
  input: z.output<typeof dummyUserInputSchema>,
) {
  const season = await getOrCreateSeasonForDate(new Date());
  await SeasonPlayerStatModel.updateOne(
    { _id: getSeasonPlayerStatId(String(season._id), userId) },
    {
      $set: {
        userId,
        seasonId: season._id,
        matchesPlayed: input.matchesPlayed,
        settledMatchesPlayed: input.matchesPlayed,
        inactivityMatchesPlayed: 0,
        wins: input.wins,
      },
      $unset: { dailyMatchesPlayedIncrementDay: 1 },
    },
    { upsert: true },
  );
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

async function findUserByIgn(ign: string) {
  return UserModel.findOne({ ign })
    .collation({ locale: "en", strength: 2 })
    .select("_id")
    .lean();
}

async function updateDummyUser(
  filter: Record<string, unknown>,
  input: z.output<typeof dummyUserInputSchema>,
) {
  const user = await UserModel.findOneAndUpdate(
    filter,
    { $set: rankingFields(input) },
    { returnDocument: "after", runValidators: true, timestamps: false },
  );
  if (!user) {
    throw new Error(
      "Select an existing seeded dummy user, or choose New dummy user.",
    );
  }
  return user;
}

export async function listDevDummyUsers(): Promise<DevDummyUser[]> {
  await connectDb();
  const users = await UserModel.find({
    email: DEV_DUMMY_USER_EMAIL_PATTERN,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  })
    .select("_id displayName ign matchesPlayed wins")
    .sort({ displayName: 1, ign: 1 })
    .lean();
  return users.map((user) => ({
    id: String(user._id),
    displayName: user.displayName,
    ign: user.ign ?? "",
    matchesPlayed: user.matchesPlayed ?? "0",
    wins: user.wins ?? "0",
  }));
}

export async function saveDevDummyUser(
  rawInput: unknown,
  selectedUserId?: string,
) {
  const input = dummyUserInputSchema.parse(rawInput);
  await connectDb();

  if (selectedUserId) {
    const dummyUser = await updateDummyUser(
      {
        _id: selectedUserId,
        email: DEV_DUMMY_USER_EMAIL_PATTERN,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      input,
    );
    await setCurrentSeasonStats(String(dummyUser._id), input);
    return { created: false, user: toDevDummyUser(dummyUser) };
  }

  if (await findUserByIgn(input.ign)) {
    throw new Error("A user with this in-game name already exists.");
  }

  const email = getDummyUserEmail(input.ign);
  try {
    const dummyUser = await UserModel.create({
      email,
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      ...rankingFields(input),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await setCurrentSeasonStats(String(dummyUser._id), input);
    return { created: true, user: toDevDummyUser(dummyUser) };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    if (await findUserByIgn(input.ign)) {
      throw new Error("A user with this in-game name already exists.");
    }
    throw new Error(
      "The generated dummy-user email conflicts with an existing account.",
    );
  }
}

function toDevDummyUser(user: {
  _id: { toString(): string };
  displayName: string;
  ign?: string;
  matchesPlayed?: string;
  wins?: string;
}): DevDummyUser {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    ign: user.ign ?? "",
    matchesPlayed: user.matchesPlayed ?? "0",
    wins: user.wins ?? "0",
  };
}
