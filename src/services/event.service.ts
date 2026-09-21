import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { IGN_COUNTS } from "@/config/defaults";
import { eventRepository } from "@/repositories/event.repository";
import { applyLedger } from "@/services/wallet.service";
import { auditRepository } from "@/repositories/ops.repository";
import { CoinTxnType, EventFormat, EventStatus } from "@/types/enums";

const eventSchema = z.object({
  name: z.string().min(3),
  eventDate: z.string(),
  startTime: z.string(),
  registrationOpensAt: z.string(),
  registrationClosesAt: z.string(),
  format: z.enum([EventFormat.SOLO, EventFormat.DUO, EventFormat.SQUAD]),
  maxSlots: z.number().int().positive(),
  entryFeeCoins: z.number().int().min(0),
  prizeDistribution: z.object({
    platformProfit: z.number().min(0),
    first: z.number().min(0),
    second: z.number().min(0),
    third: z.number().min(0),
  }),
  characterSkill: z.boolean(),
  unlimitedGlooWall: z.boolean(),
  roomRules: z.string().optional(),
  customNotes: z.string().optional(),
});

const registerSchema = z.object({
  eventId: z.string(),
  igns: z.array(z.string().min(2)).min(1),
});

export async function createEvent(adminId: string, raw: unknown) {
  const input = eventSchema.parse(raw);
  await connectDb();
  const event = await eventRepository.create({
    ...input,
    eventDate: new Date(input.eventDate),
    registrationOpensAt: new Date(input.registrationOpensAt),
    registrationClosesAt: new Date(input.registrationClosesAt),
    createdBy: adminId,
    status: EventStatus.DRAFT,
  });
  await auditRepository.write({
    actorId: adminId,
    action: "event.create",
    entityType: "HostedEvent",
    entityId: String(event._id),
  });
  return event;
}

export async function updateEvent(adminId: string, eventId: string, raw: unknown) {
  const input = eventSchema.partial().parse(raw);
  await connectDb();
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError("Event not found.", "NOT_FOUND", 404);
  Object.assign(event, {
    ...input,
    eventDate: input.eventDate ? new Date(input.eventDate) : event.eventDate,
    registrationOpensAt: input.registrationOpensAt
      ? new Date(input.registrationOpensAt)
      : event.registrationOpensAt,
    registrationClosesAt: input.registrationClosesAt
      ? new Date(input.registrationClosesAt)
      : event.registrationClosesAt,
  });
  await event.save();
  await auditRepository.write({
    actorId: adminId,
    action: "event.update",
    entityType: "HostedEvent",
    entityId: eventId,
  });
  return event;
}

export async function transitionEvent(adminId: string, eventId: string, status: EventStatus) {
  await connectDb();
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError("Event not found.", "NOT_FOUND", 404);
  event.status = status;
  await event.save();
  await auditRepository.write({
    actorId: adminId,
    action: "event.status",
    entityType: "HostedEvent",
    entityId: eventId,
    metadata: { status },
  });
  return event;
}

export async function saveEventRoom(
  adminId: string,
  eventId: string,
  roomId: string,
  roomPassword: string,
) {
  await connectDb();
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError("Event not found.", "NOT_FOUND", 404);
  event.roomId = roomId;
  event.roomPassword = roomPassword;
  await event.save();
  await auditRepository.write({
    actorId: adminId,
    action: "event.room",
    entityType: "HostedEvent",
    entityId: eventId,
  });
}

function canRegister(status: EventStatus) {
  return status === EventStatus.PUBLISHED || status === EventStatus.REGISTRATION_OPEN;
}

export async function registerForEvent(userId: string, raw: unknown) {
  const input = registerSchema.parse(raw);
  await connectDb();

  return withTransaction(async (session) => {
    const event = await eventRepository.findById(input.eventId, session);
    if (!event || !canRegister(event.status as EventStatus)) {
      throw new AppError("This event is not open for registration.", "EVENT_CLOSED");
    }
    const now = new Date();
    if (now < event.registrationOpensAt || now > event.registrationClosesAt) {
      throw new AppError("Registration window is closed.", "WINDOW_CLOSED");
    }
    const required = IGN_COUNTS[event.format as keyof typeof IGN_COUNTS];
    if (input.igns.length !== required || input.igns.some((ign) => !ign.trim())) {
      throw new AppError(`This format requires exactly ${required} IGN(s).`, "IGN_COUNT");
    }
    const existing = await eventRepository.findTeam(input.eventId, userId, session);
    if (existing) throw new AppError("You already registered for this event.", "ALREADY_REGISTERED");
    if (event.reservedSlots >= event.maxSlots) {
      throw new AppError("Event is full.", "EVENT_FULL");
    }

    event.reservedSlots += 1;
    await event.save({ session });

    const team = await eventRepository.addTeam(
      {
        eventId: input.eventId,
        captainId: userId,
        igns: input.igns.map((i) => i.trim()),
        slotNumber: event.reservedSlots,
        paidCoins: event.entryFeeCoins,
      },
      session,
    );

    if (event.entryFeeCoins > 0) {
      await applyLedger({
        userId,
        type: CoinTxnType.TOURNAMENT_ENTRY,
        amount: -event.entryFeeCoins,
        availableDelta: -event.entryFeeCoins,
        lockedDelta: 0,
        referenceType: "HostedEvent",
        referenceId: input.eventId,
        idempotencyKey: `event-entry:${input.eventId}:${userId}`,
        session,
      });
    }

    return team;
  });
}

export async function payEventPrizes(
  adminId: string,
  eventId: string,
  placements: { teamId: string; placement: 1 | 2 | 3 }[],
) {
  await connectDb();
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError("Event not found.", "NOT_FOUND", 404);
  const teams = await eventRepository.listTeams(eventId);
  const prizeFor = {
    1: event.prizeDistribution.first,
    2: event.prizeDistribution.second,
    3: event.prizeDistribution.third,
  };

  await withTransaction(async (session) => {
    for (const row of placements) {
      const team = teams.find((t) => String(t._id) === row.teamId);
      if (!team) continue;
      const amount = prizeFor[row.placement];
      if (!amount) continue;
      await applyLedger({
        userId: String(team.captainId),
        type: CoinTxnType.PRIZE_PAYOUT,
        amount,
        availableDelta: amount,
        lockedDelta: 0,
        referenceType: "HostedEvent",
        referenceId: eventId,
        idempotencyKey: `event-prize:${eventId}:${row.placement}:${team.captainId}`,
        session,
      });
    }
    event.status = EventStatus.COMPLETED;
    await event.save({ session });
  });

  await auditRepository.write({
    actorId: adminId,
    action: "event.prizes",
    entityType: "HostedEvent",
    entityId: eventId,
    metadata: { placements },
  });
}

export async function listPublicEvents() {
  await connectDb();
  return eventRepository.listPublic();
}

export async function getEventDetail(eventId: string, isAdmin: boolean) {
  await connectDb();
  const event = isAdmin
    ? await eventRepository.findByIdWithRoom(eventId)
    : await eventRepository.findById(eventId);
  if (!event) throw new AppError("Event not found.", "NOT_FOUND", 404);
  if (!isAdmin && event.status === EventStatus.DRAFT) {
    throw new AppError("Event not found.", "NOT_FOUND", 404);
  }
  const teams = isAdmin ? await eventRepository.listTeams(eventId) : [];
  return { event: JSON.parse(JSON.stringify(event)), teams };
}
