import { connectDb } from "@/lib/db/mongoose";
import { HostedEventModel } from "@/models/hosted-event";
import { MatchModel } from "@/models/match";
import { SupportTicketModel } from "@/models/support-ticket";
import { WithdrawalModel } from "@/models/withdrawal";
import {
  EventStatus,
  MatchStatus,
  SupportStatus,
  WithdrawalStatus,
} from "@/types/enums";

export type AdminActionNotifications = {
  matches: boolean;
  events: boolean;
  rewardFulfilment: boolean;
  support: boolean;
};

export async function getAdminActionNotifications(): Promise<AdminActionNotifications> {
  await connectDb();

  const [pendingMatches, pendingEvents, pendingRewards, activeTickets] =
    await Promise.all([
      MatchModel.countDocuments({ status: MatchStatus.DISPUTED }),
      HostedEventModel.countDocuments({
        status: { $in: [EventStatus.DRAFT, EventStatus.LIVE] },
      }),
      WithdrawalModel.countDocuments({
        status: { $in: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED] },
      }),
      SupportTicketModel.countDocuments({
        source: "manual",
        status: {
          $in: [
            SupportStatus.AI_ACTIVE,
            SupportStatus.PENDING_ADMIN,
            SupportStatus.ADMIN_ACTIVE,
          ],
        },
      }),
    ]);

  return {
    matches: pendingMatches > 0,
    events: pendingEvents > 0,
    rewardFulfilment: pendingRewards > 0,
    support: activeTickets > 0,
  };
}
