import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function rupeesToCoins(rupees: number, coinsPerRupee: number) {
  return Math.round(rupees * coinsPerRupee);
}

export function coinsToRupees(coins: number, coinsPerRupee: number) {
  return coins / coinsPerRupee;
}

export function applyPercent(amount: number, percent: number) {
  return Math.round((amount * percent) / 100);
}

export function serializeDoc<T extends { _id?: unknown }>(
  doc: T,
): Omit<T, "_id"> & { id: string } {
  const raw = JSON.parse(JSON.stringify(doc)) as T & { _id: string };
  const { _id, ...rest } = raw;
  return { ...rest, id: String(_id) };
}

export function todayUtcStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
