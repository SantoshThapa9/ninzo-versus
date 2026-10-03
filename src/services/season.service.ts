import { connectDb } from "@/lib/db/mongoose";
import { SeasonModel } from "@/models/season";

function getMonthDates(date: Date) {
  const startDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const nextMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  );
  const month = startDate.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const year = startDate.getUTCFullYear();

  return {
    id: `${month.toLowerCase()}-${year}`,
    slug: `${month.toLowerCase()}-${year}`,
    name: `${month} ${year}`,
    startDate,
    endDate: new Date(nextMonth.getTime() - 1),
  };
}

export async function getOrCreateSeasonForDate(date: Date) {
  await connectDb();
  const season = getMonthDates(date);
  const status =
    season.startDate.getTime() === getMonthDates(new Date()).startDate.getTime()
      ? "active"
      : "completed";

  try {
    await SeasonModel.updateOne(
      { slug: season.slug },
      {
        $set: { status },
        $setOnInsert: season,
      },
      { upsert: true },
    );
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
  }

  const result = await SeasonModel.findOne({ slug: season.slug }).lean();
  if (!result) throw new Error(`Unable to create season ${season.slug}.`);
  return result;
}

export async function listSeasons() {
  const current = await getOrCreateSeasonForDate(new Date());
  await SeasonModel.updateMany(
    { status: "active", _id: { $ne: current._id } },
    { $set: { status: "completed" } },
  );
  return SeasonModel.find().sort({ startDate: -1 }).lean();
}

export async function getSeasonBySlug(slug?: string) {
  const seasons = await listSeasons();
  const season = seasons.find((item) => item.slug === slug) ?? seasons[0];
  if (!season) throw new Error("No monthly seasons are available.");
  return season;
}
