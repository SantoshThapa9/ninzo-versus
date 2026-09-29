import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { isValidTokenAmount, roundTokens } from "@/lib/utils";
import { DEFAULT_PRIZE_SPLIT } from "@/config/defaults";
import { eventRepository } from "@/repositories/event.repository";
import { applyLedger } from "@/services/wallet.service";
import { auditRepository } from "@/repositories/ops.repository";
import { getCurrentUserIdentity } from "@/services/player-profile.service";
import { CoinTxnType, EventFormat, EventStatus } from "@/types/enums";

const eventSchema = z.object({
  name: z.string().min(3),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid event date."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid start time."),
  format: z.enum([EventFormat.SOLO, EventFormat.DUO, EventFormat.SQUAD]),
  maxSlots: z.number().int().positive(),
  entryFeeCoins: z.number().min(0).refine(
    (amount) => amount === 0 || isValidTokenAmount(amount),
    { message: "NV Tokens can have up to two decimal places." },
  ),
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
}).refine(
  (value) =>
    value.prizeDistribution.platformProfit === DEFAULT_PRIZE_SPLIT.platformProfitPercent &&
    value.prizeDistribution.first === DEFAULT_PRIZE_SPLIT.firstPercent &&
    value.prizeDistribution.second === DEFAULT_PRIZE_SPLIT.secondPercent &&
    value.prizeDistribution.third === DEFAULT_PRIZE_SPLIT.thirdPercent,
  "The event reward split is fixed at 50% / 30% / 10% with 10% for the platform.",
);

function eventStartAt(eventDate: string, startTime: string) {
  const value = new Date(`${eventDate}T${startTime}:00+05:30`);
  if (Number.isNaN(value.getTime())) throw new AppError("Choose a valid event start.", "INVALID_EVENT_START");
  return value;
}

const registerSchema = z.object({
  eventId: z.string(),
});

export async function createEvent(adminId: string, raw: unknown) {
  const input = eventSchema.parse(raw);
  await connectDb();
  const event = await eventRepository.create({
    ...input,
    eventDate: new Date(`${input.eventDate}T00:00:00.000Z`),
    registrationOpensAt: new Date(),
    registrationClosesAt: eventStartAt(input.eventDate, input.startTime),
    createdBy: adminId,
    status: EventStatus.PUBLISHED,
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
  const eventDate = input.eventDate ?? event.eventDate.toISOString().slice(0, 10);
  const startTime = input.startTime ?? event.startTime;
  Object.assign(event, {
    ...input,
    eventDate: new Date(`${eventDate}T00:00:00.000Z`),
    registrationClosesAt: eventStartAt(eventDate, startTime),
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
  event.roomId = roomId.trim();
  event.roomPassword = roomPassword.trim();
  if (event.roomId && event.roomPassword) {
    event.status = EventStatus.LIVE;
  }
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
    if (now > event.registrationClosesAt) {
      throw new AppError("Registration window is closed.", "WINDOW_CLOSED");
    }
    const identity = await getCurrentUserIdentity(userId);
    if (!identity.ign) {
      throw new AppError("Add your In Game Name in Profile before registering.", "IGN_REQUIRED");
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
        igns: [identity.ign],
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
  const prizePool = roundTokens(teams.length * event.entryFeeCoins);
  const prizeFor = {
    1: roundTokens((prizePool * event.prizeDistribution.first) / 100),
    2: roundTokens((prizePool * event.prizeDistribution.second) / 100),
    3: roundTokens((prizePool * event.prizeDistribution.third) / 100),
  };

  await withTransaction(async (session) => {
    for (const row of placements) {
      const team = teams.find((t) => String(t._id) === row.teamId);
      if (!team) continue;
      const amount = prizeFor[row.placement];
      await eventRepository.setTeamPlacement(row.teamId, row.placement, session);
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

export type CompletedEventResult = {
  id: string;
  name: string;
  eventDate: Date;
  format: string;
  placements: { placement: number; igns: string[] }[];
};

export async function listCompletedEventResults(): Promise<CompletedEventResult[]> {
  await connectDb();
  const events = await eventRepository.listCompleted();
  if (!events.length) return [];

  const teams = await eventRepository.listPlacedTeams(events.map((event) => String(event._id)));
  const placementsByEvent = new Map<string, { placement: number; igns: string[] }[]>();
  for (const team of teams) {
    const eventId = String(team.eventId);
    const placements = placementsByEvent.get(eventId) ?? [];
    placements.push({ placement: team.placement!, igns: team.igns });
    placementsByEvent.set(eventId, placements);
  }

  return events.map((event) => ({
    id: String(event._id),
    name: event.name,
    eventDate: event.eventDate,
    format: event.format,
    placements: placementsByEvent.get(String(event._id)) ?? [],
  }));
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
