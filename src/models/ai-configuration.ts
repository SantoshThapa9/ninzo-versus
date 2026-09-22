import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Types,
} from "mongoose";
import { ECONOMY_DEFAULTS, MEDIA_DEFAULTS } from "@/config/defaults";

const AIConfigurationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    visionEnabled: { type: Boolean, default: true },
    supportAiEnabled: { type: Boolean, default: true },
    visionModel: { type: String, default: "gpt-5-nano" },
    chatModel: { type: String, default: "gpt-5-nano" },
    nvCoinsPerRupee: {
      type: Number,
      default: ECONOMY_DEFAULTS.nvCoinsPerRupee,
    },
    minDepositCoins: {
      type: Number,
      default: ECONOMY_DEFAULTS.minDepositCoins,
    },
    minWithdrawalCoins: {
      type: Number,
      default: ECONOMY_DEFAULTS.minWithdrawalCoins,
    },
    depositFeePercent: {
      type: Number,
      default: ECONOMY_DEFAULTS.depositFeePercent,
    },
    withdrawalFeePercent: {
      type: Number,
      default: ECONOMY_DEFAULTS.withdrawalFeePercent,
    },
    maxWithdrawalsPerDay: {
      type: Number,
      default: ECONOMY_DEFAULTS.maxWithdrawalsPerDay,
    },
    platformFeePercent: {
      type: Number,
      default: ECONOMY_DEFAULTS.platformFeePercent,
    },
    mediaRetentionDays: {
      type: Number,
      default: MEDIA_DEFAULTS.tempRetentionDays,
    },
    clashWarning: { type: String },
  },
  { timestamps: true },
);

export type AIConfigurationDoc = InferSchemaType<
  typeof AIConfigurationSchema
> & {
  _id: Types.ObjectId;
};

export const AIConfigurationModel =
  models.AIConfiguration || model("AIConfiguration", AIConfigurationSchema);
