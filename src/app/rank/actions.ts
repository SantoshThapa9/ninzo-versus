"use server";

import { updateTag } from "next/cache";

export async function invalidateRankingsForNavigation() {
  updateTag("global-rankings");
}
