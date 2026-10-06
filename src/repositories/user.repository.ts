import mongoose from "mongoose";
import { UserModel, type UserDoc } from "@/models/user";
import { UserRole } from "@/types/enums";
import { SeasonModel } from "@/models/season";

type Session = mongoose.ClientSession;
type ObjectId = mongoose.Types.ObjectId;

function incrementNumericString(field: string) {
  const numericValue = {
    $convert: {
      input: `$${field}`,
      to: "long",
      onError: null,
      onNull: 0,
    },
  };
  return {
    $cond: [
      { $ne: [numericValue, null] },
      { $toString: { $add: [numericValue, 1] } },
      `$${field}`,
    ],
  };
}

export const userRepository = {
  findById(id: string, session?: Session) {
    return UserModel.findById(id).session(session ?? null);
  },
  findByIdLean(id: string) {
    return UserModel.findById(id)
      .select("displayName email ign age upiId phoneNumber")
      .lean();
  },
  findByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() });
  },
  findByIds(ids: string[]) {
    return UserModel.find({ _id: { $in: ids } })
      .select("displayName email availableCoins lockedCoins")
      .lean();
  },
  findIdentitiesByIds(ids: string[]) {
    return UserModel.find({ _id: { $in: ids } })
      .select("_id ign")
      .maxTimeMS(5_000)
      .lean();
  },
  findPlatform(session?: Session) {
    return UserModel.findOne({ role: UserRole.PLATFORM }).session(session ?? null);
  },
  create(
    data: {
      email: string;
      passwordHash: string;
      displayName: string;
      role?: UserDoc["role"];
      status?: UserDoc["status"];
      availableCoins?: number;
      lockedCoins?: number;
    },
    session?: Session,
  ) {
    return UserModel.create([data], { session }).then((docs) => docs[0]);
  },
  updateById(id: string, update: Record<string, unknown>, session?: Session) {
    return UserModel.findByIdAndUpdate(id, update, { returnDocument: "after", session });
  },
  async recordSettledMatchResult(
    participantIds: [string, string],
    winnerId: string,
    seasonId: ObjectId,
    session: Session,
  ) {
    const participants = [...new Set(participantIds)];
    if (
      participants.length !== 2 ||
      !participants.includes(winnerId)
    ) {
      throw new Error("A ranked match must have two distinct participants and a valid winner.");
    }

    // A match in an archived month cannot update the active monthly counters.
    const activeSeason = await SeasonModel.exists({
      _id: seasonId,
      status: "active",
      rankingsSnapshottedAt: { $exists: false },
      rankingsSnapshotStartedAt: { $exists: false },
    }).session(session);
    if (!activeSeason) return;

    // This is called exclusively from the settlement transaction. The match's
    // SETTLED transition and both player counter writes therefore commit or roll back
    // together; retries cannot count the same match twice.
    const result = await UserModel.bulkWrite(
      participants.map((userId) => ({
        updateOne: {
          filter: { _id: userId },
          update: [
            {
              $set: {
                matchesPlayed: incrementNumericString("matchesPlayed"),
                ...(userId === winnerId
                  ? { wins: incrementNumericString("wins") }
                  : {}),
              },
            },
          ],
        },
      })),
      { session },
    );

    if (result.matchedCount !== participants.length) {
      throw new Error("Match participant no longer exists.");
    }
  },
  updateProfileIfAllowed(
    id: string,
    profile: {
      displayName?: string;
      ign?: string;
      age?: number;
      upiId?: string;
      phoneNumber?: string;
    },
    cutoff: Date,
    session?: Session,
  ) {
    const hasPaymentChanges =
      profile.upiId !== undefined || profile.phoneNumber !== undefined;
    const hasGeneralChanges =
      profile.displayName !== undefined ||
      profile.ign !== undefined ||
      profile.age !== undefined;
    const guards: Record<string, unknown>[] = [{ _id: id }];
    if (hasGeneralChanges) {
      guards.push({
        $or: [
          { updatedAt: { $exists: false } },
          { updatedAt: null },
          { updatedAt: { $lte: cutoff } },
        ],
      });
    }
    if (hasPaymentChanges) {
      guards.push({
        $or: [
          { paymentDetailUpdateAt: { $exists: false } },
          { paymentDetailUpdateAt: null },
          { paymentDetailUpdateAt: { $lte: cutoff } },
        ],
      });
    }

    return UserModel.findOneAndUpdate(
      { $and: guards },
      {
        $set: {
          ...profile,
          ...(hasPaymentChanges ? { paymentDetailUpdateAt: new Date() } : {}),
        },
      },
      {
        returnDocument: "after",
        session,
        timestamps: hasGeneralChanges,
      },
    );
  },
  updateAgeIfAllowed(id: string, age: number, cutoff: Date) {
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { updatedAt: { $exists: false } },
          { updatedAt: null },
          { updatedAt: { $lte: cutoff } },
        ],
      },
      { $set: { age } },
      { returnDocument: "after" },
    );
  },
  updatePayoutDetailsForAdultIfAllowed(
    id: string,
    upiId: string,
    phoneNumber: string,
    cutoff: Date,
    session?: Session,
  ) {
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        age: { $gte: 18 },
        $or: [
          { paymentDetailUpdateAt: { $exists: false } },
          { paymentDetailUpdateAt: null },
          { paymentDetailUpdateAt: { $lte: cutoff } },
        ],
      },
      { $set: { upiId, phoneNumber, paymentDetailUpdateAt: new Date() } },
      { returnDocument: "after", session, timestamps: false },
    );
  },
  list(filter: Record<string, unknown> = {}, limit = 50) {
    return UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  },
};
