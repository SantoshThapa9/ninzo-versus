import { connectDb } from "@/lib/db/mongoose";
import { unstable_cache } from "next/cache";
import { Types } from "mongoose";
import { SeasonModel, type SeasonDoc } from "@/models/season";

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
  if (result.rankingsSnapshottedAt && result.status !== "completed") {
    await SeasonModel.updateOne(
      { _id: result._id, rankingsSnapshottedAt: { $exists: true } },
      { $set: { status: "completed" } },
    ).exec();
    result.status = "completed";
  }
  return result;
}

type CachedSeason = {
  _id: string;
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SeasonDoc["status"];
  rankingsSnapshottedAt?: string;
};

const getCachedSeasons = unstable_cache(
  async (monthKey: string): Promise<CachedSeason[]> => {
    const [year, month] = monthKey.split("-").map(Number);
    const current = await getOrCreateSeasonForDate(
      new Date(Date.UTC(year, month - 1, 1)),
    );
    await SeasonModel.updateMany(
      { status: "active", _id: { $ne: current._id } },
      { $set: { status: "completed" } },
    )
      .maxTimeMS(5_000)
      .exec();
    const seasons = await SeasonModel.find()
      .sort({ startDate: -1 })
      .maxTimeMS(5_000)
      .lean();
    return seasons.map((season) => ({
      _id: String(season._id),
      id: season.id,
      slug: season.slug,
      name: season.name,
      startDate: season.startDate.toISOString(),
      endDate: season.endDate.toISOString(),
      status: season.status,
      rankingsSnapshottedAt: season.rankingsSnapshottedAt?.toISOString(),
    }));
  },
  ["monthly-seasons"],
  { revalidate: 300, tags: ["monthly-seasons"] },
);

export async function listSeasons() {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  const seasons = await getCachedSeasons(monthKey);
  return seasons.map((season) => ({
    ...season,
    _id: new Types.ObjectId(season._id),
    startDate: new Date(season.startDate),
    endDate: new Date(season.endDate),
    rankingsSnapshottedAt: season.rankingsSnapshottedAt
      ? new Date(season.rankingsSnapshottedAt)
      : undefined,
  }));
}

export async function getSeasonBySlug(slug?: string) {
  const seasons = await listSeasons();
  const season = seasons.find((item) => item.slug === slug) ?? seasons[0];
  if (!season) throw new Error("No monthly seasons are available.");
  return season;
}
