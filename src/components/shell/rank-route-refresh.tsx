"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { invalidateRankingsForNavigation } from "@/app/rank/actions";

export function RankRouteRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const enteredRank = pathname === "/rank" && previousPathname.current !== "/rank";
    previousPathname.current = pathname;
    if (!enteredRank) return;

    let cancelled = false;
    void invalidateRankingsForNavigation()
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't refresh rankings. Try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
