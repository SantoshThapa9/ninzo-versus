import { model, models, Schema, type Types } from "mongoose";

const AndroidAuthHandoffSchema = new Schema(
  {
    ticketHash: { type: String, required: true, unique: true },
    codeChallenge: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false },
);

export type AndroidAuthHandoff = {
  ticketHash: string;
  codeChallenge: string;
  userId: Types.ObjectId;
  expiresAt: Date;
};

export const AndroidAuthHandoffModel =
  models.AndroidAuthHandoff ||
  model<AndroidAuthHandoff>("AndroidAuthHandoff", AndroidAuthHandoffSchema);
