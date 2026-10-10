"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import type { AdminActionNotifications } from "@/services/admin-action-notification.service";

const links: {
  key: keyof AdminActionNotifications | null;
  label: string;
  href: string;
}[] = [
  { key: "matches", label: "Matches", href: "/admin/matches" },
  { key: "events", label: "Events", href: "/admin/events" },
  { key: null, label: "New event", href: "/admin/events/new" },
  {
    key: "rewardFulfilment",
    label: "Reward Fulfilment",
    href: "/admin/withdrawals",
  },
  { key: "support", label: "Support", href: "/admin/support" },
];

function isAdminActionNotifications(
  value: unknown,
): value is AdminActionNotifications {
  if (typeof value !== "object" || value === null) return false;
  return (
    "matches" in value &&
    typeof value.matches === "boolean" &&
    "events" in value &&
    typeof value.events === "boolean" &&
    "rewardFulfilment" in value &&
    typeof value.rewardFulfilment === "boolean" &&
    "support" in value &&
    typeof value.support === "boolean"
  );
}

export function AdminHomeLinks({
  initialNotifications,
}: {
  initialNotifications: AdminActionNotifications;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function refreshNotifications() {
      try {
        const response = await fetch("/api/admin/action-notifications", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(
            `Notification status request failed (${response.status}).`,
          );
        }
        const data: unknown = await response.json();
        if (!isAdminActionNotifications(data)) {
          throw new Error("Notification status response was invalid.");
        }
        if (!active) return;
        setNotifications(data);
        setRefreshError(false);
      } catch (error) {
        if (!active) return;
        setRefreshError(true);
        console.error("[admin] Failed to refresh action notifications.", error);
      } finally {
        if (active) timeoutId = setTimeout(refreshNotifications, 10_000);
      }
    }

    void refreshNotifications();
    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">Admin</h1>
      {refreshError ? (
        <p role="status" className="text-sm text-red-400">
          Notification status could not be updated. Retrying automatically.
        </p>
      ) : null}
      {links.map(({ key, label, href }) => (
        <Link key={href} href={href}>
          <Card className="flex items-center justify-between">
            <span>{label}</span>
            {key && notifications[key] ? (
              <span
                aria-label="Action required"
                role="img"
                className="size-2.5 shrink-0 rounded-full bg-red-500"
              />
            ) : null}
          </Card>
        </Link>
      ))}
    </div>
  );
}
