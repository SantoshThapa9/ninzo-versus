const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MINUTE_MS = 60_000;

export function eventOccurrenceInIst(eventDate: string, startTime: string) {
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
