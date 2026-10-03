import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { DEV_DUMMY_USER_EMAIL_PATTERN } from "@/lib/dev-dummy-users";
import { UserModel } from "@/models/user";
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

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
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
    throw new Error("Select an existing seeded dummy user, or choose New dummy user.");
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
    return { created: false, user: toDevDummyUser(dummyUser) };
  }

  const email = getDummyUserEmail(input.ign);
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    if (
      !DEV_DUMMY_USER_EMAIL_PATTERN.test(existingUser.email) ||
      existingUser.role !== UserRole.USER ||
      existingUser.status !== UserStatus.ACTIVE
    ) {
      throw new Error("The generated dummy-user identity conflicts with an existing account.");
    }
    const updatedUser = await updateDummyUser(
      { _id: existingUser._id, email: DEV_DUMMY_USER_EMAIL_PATTERN },
      input,
    );
    return { created: false, user: toDevDummyUser(updatedUser) };
  }

  try {
    const dummyUser = await UserModel.create({
      email,
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      ...rankingFields(input),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    return { created: true, user: toDevDummyUser(dummyUser) };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const user = await updateDummyUser(
      {
        email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      input,
    );
    return { created: false, user: toDevDummyUser(user) };
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
