"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export function RankRouteRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const enteredRank = pathname === "/rank" && previousPathname.current !== "/rank";
    previousPathname.current = pathname;
    if (!enteredRank) return;

    router.refresh();
  }, [pathname, router]);

  return null;
}
