const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type EventOccurrence = {
  eventDate: string;
  startsAt: Date;
};

/**
 * Event dates are calendar dates in India, stored as UTC midnight only to
 * preserve that date in MongoDB.  Never use the host machine's local zone
 * when converting them into an occurrence.
 */
export function eventOccurrenceInIst(eventDate: string, startTime: string): EventOccurrence {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error("Invalid event occurrence.");
  }

  const [year, month, day] = eventDate.split("-").map(Number);
  const [hours, minutes] = startTime.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hours > 23 ||
    minutes > 59
  ) {
    throw new Error("Invalid event occurrence.");
  }

  return {
    eventDate,
    startsAt: new Date(Date.UTC(year, month - 1, day, hours, minutes) - IST_OFFSET_MINUTES * MINUTE_MS),
  };
}

export function eventDateFromStoredDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Returns the first daily IST occurrence strictly after `now`. */
export function nextFutureEventOccurrence(eventDate: string, startTime: string, now: Date): EventOccurrence {
  let occurrence = eventOccurrenceInIst(eventDate, startTime);
  while (occurrence.startsAt <= now) {
    const [year, month, day] = occurrence.eventDate.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day) + DAY_MS);
    occurrence = eventOccurrenceInIst(nextDate.toISOString().slice(0, 10), startTime);
  }
  return occurrence;
}
