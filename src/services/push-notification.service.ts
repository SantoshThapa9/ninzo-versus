import webpush, { type PushSubscription } from "web-push";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { connectDb } from "@/lib/db/mongoose";
import { PushSubscriptionModel } from "@/models/push-subscription";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2_048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function savePushSubscription(userId: string, raw: unknown) {
  const subscription = subscriptionSchema.parse(raw);
  await connectDb();
  // The endpoint uniquely identifies a browser profile. Upserting prevents a
  // device from accumulating duplicate records and handles account changes.
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { $set: { userId, ...subscription } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await connectDb();
  await PushSubscriptionModel.deleteOne({ userId, endpoint });
}

export async function notifyChallengeAccepted(
  creatorId: string,
  opponentIgn: string,
  matchId: string,
) {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    console.warn("[push] VAPID is not configured; challenge push was skipped.");
    return;
  }
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  await connectDb();
  const subscriptions = await PushSubscriptionModel.find({ userId: creatorId }).lean();
  const payload = JSON.stringify({
    title: "Challenge accepted",
    body: `${opponentIgn} accepted your challenge.`,
    url: `/clash/${matchId}`,
    tag: `clash-accepted-${matchId}`,
    kind: "challenge_accepted",
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription as PushSubscription, payload, {
          vapidDetails,
          TTL: 5 * 60,
          urgency: "high",
          topic: `clash-${matchId}`.slice(0, 32),
        });
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        // Push services use these codes for expired/revoked browser subscriptions.
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.deleteOne({ _id: subscription._id });
          return;
        }
        console.error("[push] Failed to send challenge acceptance notification.", {
          matchId,
          statusCode,
        });
      }
    }),
  );
}

/** Sends a push notification when the other player completes a match. */
export async function notifyMatchCompleted(
  recipientId: string,
  senderIgn: string,
  matchId: string,
) {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    console.warn("[push] VAPID is not configured; match completion push was skipped.");
    return;
  }
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  await connectDb();
  const subscriptions = await PushSubscriptionModel.find({ userId: recipientId }).lean();
  const payload = JSON.stringify({
    title: "Match completed",
    body: `${senderIgn} marked the match complete. Upload your final result screenshot.`,
    url: `/clash/${matchId}`,
    tag: `clash-completed-${matchId}`,
    kind: "match_completed",
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription as PushSubscription, payload, {
          vapidDetails,
          TTL: 5 * 60,
          urgency: "high",
          topic: `clash-done-${matchId}`.slice(0, 32),
        });
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.deleteOne({ _id: subscription._id });
          return;
        }
        console.error("[push] Failed to send match completion notification.", {
          matchId,
          statusCode,
        });
      }
    }),
  );
}

/** Sends a best-effort push for a new private-match chat message. */
export async function notifyMatchChatMessage(
  recipientId: string,
  senderIgn: string,
  matchId: string,
  messageId: string,
  body: string,
) {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    console.warn("[push] VAPID is not configured; chat push was skipped.");
    return;
  }
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  await connectDb();
  const subscriptions = await PushSubscriptionModel.find({ userId: recipientId }).lean();
  const payload = JSON.stringify({
    title: `${senderIgn} sent a message`,
    body: body.slice(0, 180),
    url: `/clash/${matchId}`,
    tag: `clash-chat-${matchId}`,
    kind: "match_chat",
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription as PushSubscription, payload, {
          vapidDetails,
          TTL: 5 * 60,
          urgency: "high",
          topic: `chat-${messageId}`.slice(0, 32),
        });
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.deleteOne({ _id: subscription._id });
          return;
        }
        console.error("[push] Failed to send match chat notification.", {
          matchId,
          statusCode,
        });
      }
    }),
  );
}

/** Sends a best-effort push when support staff reply to a customer's ticket. */
export async function notifySupportAdminReply(
  recipientId: string,
  ticketId: string,
  body: string,
) {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    console.warn("[push] VAPID is not configured; support reply push was skipped.");
    return;
  }
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  await connectDb();
  const subscriptions = await PushSubscriptionModel.find({ userId: recipientId }).lean();
  const payload = JSON.stringify({
    title: "Ninzo Support replied",
    body: body.slice(0, 180),
    url: `/support/${ticketId}`,
    tag: `support-reply-${ticketId}`,
    kind: "support_reply",
  });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription as PushSubscription, payload, {
          vapidDetails,
          TTL: 5 * 60,
          urgency: "high",
          topic: `support-${ticketId}`.slice(0, 32),
        });
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.deleteOne({ _id: subscription._id });
          return;
        }
        console.error("[push] Failed to send support reply notification.", {
          ticketId,
          statusCode,
        });
      }
    }),
  );
}
