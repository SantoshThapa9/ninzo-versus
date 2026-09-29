"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";

const COMPLETED_KEY = "ninzo-versus-tour-completed";

type Stop = "profile" | "clash" | "inventory" | "rank";

const routeFor: Record<Stop, string> = {
  profile: "/profile",
  clash: "/lobby",
  inventory: "/inventory",
  rank: "/rank",
};

export function AppTour() {
  const pathname = usePathname();
  const router = useRouter();
  const tourRef = useRef<Driver | null>(null);
  const nextStopRef = useRef<Stop | null>(null);

  useEffect(() => {
    if (localStorage.getItem(COMPLETED_KEY)) return;

    const nextStop = nextStopRef.current;
    if (!nextStop && pathname === "/") {
      nextStopRef.current = "clash";
      router.replace("/lobby");
      return;
    }
    if (!nextStop && pathname !== "/lobby") {
      router.replace("/");
      return;
    }
    const stop = nextStop ?? "clash";

    const goTo = (next: Stop) => {
      nextStopRef.current = next;
      tourRef.current?.destroy();
      router.push(routeFor[next]);
    };

    const finish = () => {
      localStorage.setItem(COMPLETED_KEY, "true");
    };

    const step = (
      element: string,
      title: string,
      description: string,
      next?: Stop,
    ): DriveStep => ({
      element,
      popover: {
        title,
        description,
        ...(next ? { onNextClick: () => goTo(next) } : {}),
      },
    });

    const steps: Record<string, DriveStep[]> = {
      profile: [
        step(
          "[data-tour='ign']",
          "Set your In Game Name",
          "Use the exact name shown in Free Fire so opponents can find you.",
        ),
        {
          element: "[data-tour='uid']",
          popover: {
            title: "Save your game details",
            description:
              "Save your In Game Name and Free Fire UID after signing in. You can update them once every 24 hours.",
            doneBtnText: "Sign in to save",
            onDoneClick: () => {
              finish();
              tourRef.current?.destroy();
              router.push("/login?callbackUrl=/profile");
            },
          },
        },
      ],
      clash: [
        step(
          "[data-tour='post-challenge']",
          "Welcome to Clash",
          "This is the Clash arena. Create a challenge when you're ready to face another player.",
        ),
        step(
          "[data-tour='daily-events']",
          "Check daily events",
          "Daily organizer events are another way to play and build your record.",
          "inventory",
        ),
      ],
      inventory: [
        {
          element: "[data-tour='token-balance']",
          popover: {
            title: "NV Tokens power challenge entry",
            description:
              "Your available tokens are used for eligible challenge registrations. You can earn more through daily events and rewards.",
            onNextClick: () => goTo("rank"),
          },
        },
      ],
      rank: [
        {
          element: "[data-tour='rank-heading']",
          popover: {
            title: "Build your rank",
            description:
              "Win settled challenges to improve your win rate and climb the global Rank board.",
            doneBtnText: "Set profile",
            onDoneClick: () => goTo("profile"),
          },
        },
      ],
    };

    const tour = driver({
      steps: steps[stop],
      animate: true,
      allowClose: true,
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      popoverClass: "ninzo-tour-popover",
    });
    tourRef.current = tour;
    tour.drive();

    return () => tour.destroy();
  }, [pathname, router]);

  return null;
}
