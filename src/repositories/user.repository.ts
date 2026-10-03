import mongoose from "mongoose";
import { UserModel, type UserDoc } from "@/models/user";
import { SeasonPlayerStatModel } from "@/models/season-player-stat";
import { UserRole } from "@/types/enums";
import { lastMatchPlayedDateExpression } from "@/lib/last-match-played";
import { getSeasonPlayerStatId } from "@/lib/season-player-stat";
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
  /**
   * Earlier imports stored Mongo shell notation (for example
   * `ISODate("...")`) as text. Convert it in the database before hydrating a
   * User document, otherwise Mongoose caches a cast error on that document
   * and rejects unrelated wallet saves.
   */
  normalizeLegacyLastMatchPlayed(id: string, session?: Session) {
    return UserModel.updateOne(
      { _id: id, lastMatchPlayed: { $type: "string" } },
      [{ $set: { lastMatchPlayed: lastMatchPlayedDateExpression() } }],
      { session, updatePipeline: true },
    );
  },
  findById(id: string, session?: Session) {
    return UserModel.findById(id).session(session ?? null);
  },
  findByIdLean(id: string) {
    return UserModel.findById(id)
      .select("displayName email ign uid age upiId phoneNumber lastMatchPlayed")
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
      .select("_id ign uid")
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
    winnerId: string | undefined,
    completedAt: Date,
    seasonId: ObjectId,
    session: Session,
  ) {
    const participants = [...new Set(participantIds)];
    if (
      participants.length !== 2 ||
      (winnerId !== undefined && !participants.includes(winnerId))
    ) {
      throw new Error("A settled match must have two distinct participants and a valid winner.");
    }

    // This is called exclusively from the settlement transaction. The match's
    // SETTLED transition and both counter writes therefore commit or roll back
    // together; retries cannot count the same match twice.
    const result = await UserModel.bulkWrite(
      participants.map((userId) => ({
        updateOne: {
          filter: { _id: userId },
          update: [
            {
              $set: {
                matchesPlayed: incrementNumericString("matchesPlayed"),
                lastMatchPlayed: completedAt,
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

    const seasonIsSnapshotted = await SeasonModel.exists({
      _id: seasonId,
      rankingsSnapshottedAt: { $exists: true },
    }).session(session);
    if (!seasonIsSnapshotted) {
      const seasonResult = await SeasonPlayerStatModel.bulkWrite(
        participants.map((userId) => ({
          updateOne: {
            filter: { _id: getSeasonPlayerStatId(String(seasonId), userId) },
            update: {
              $inc: {
                matchesPlayed: 1,
                settledMatchesPlayed: 1,
                ...(userId === winnerId ? { wins: 1 } : {}),
              },
              $setOnInsert: {
                userId,
                seasonId,
              },
            },
            upsert: true,
          },
        })),
        { session },
      );

      if (
        seasonResult.matchedCount + seasonResult.upsertedCount !==
        participants.length
      ) {
        throw new Error("Could not update all monthly match statistics.");
      }
    }
  },
  updateGameIdentity(id: string, ign: string, uid: string, session?: Session) {
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { ign, uid } },
      { returnDocument: "after", session },
    );
  },
  updateDisplayNameIfAllowed(
    id: string,
    displayName: string,
    cutoff: Date,
    session?: Session,
  ) {
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { displayNameUpdatedAt: { $exists: false } },
          { displayNameUpdatedAt: null },
          { displayNameUpdatedAt: { $lte: cutoff } },
        ],
      },
      { $set: { displayName, displayNameUpdatedAt: new Date() } },
      { returnDocument: "after", session },
    );
  },
  updateAgeWithoutChange(id: string, age: number) {
    const isAdultConfirmed = age >= 18;
    return UserModel.findOneAndUpdate(
      { _id: id, age },
      {
        $set: {
          isAdultConfirmed,
          ...(isAdultConfirmed ? { adultConfirmationAt: new Date() } : {}),
        },
      },
      { returnDocument: "after" },
    );
  },
  updateAgeIfAllowed(id: string, age: number, cutoff: Date) {
    const isAdultConfirmed = age >= 18;
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { ageUpdatedAt: { $exists: false } },
          { ageUpdatedAt: null },
          { ageUpdatedAt: { $lte: cutoff } },
        ],
      },
      {
        $set: {
          age,
          ageUpdatedAt: new Date(),
          isAdultConfirmed,
          ...(isAdultConfirmed ? { adultConfirmationAt: new Date() } : {}),
        },
      },
      { returnDocument: "after" },
    );
  },
  updatePayoutDetailsIfAllowed(
    id: string,
    upiId: string,
    phoneNumber: string,
    cutoff: Date,
    session?: Session,
  ) {
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        isAdultConfirmed: true,
        $or: [
          { payoutDetailsUpdatedAt: { $exists: false } },
          { payoutDetailsUpdatedAt: null },
          { payoutDetailsUpdatedAt: { $lte: cutoff } },
        ],
      },
      { $set: { upiId, phoneNumber, payoutDetailsUpdatedAt: new Date() } },
      { returnDocument: "after", session },
    );
  },
  list(filter: Record<string, unknown> = {}, limit = 50) {
    return UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  },
};
