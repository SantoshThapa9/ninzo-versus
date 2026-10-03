import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import { ChatNotificationListener } from "@/components/match/chat-notification-listener";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ninzo-versus.vercel.app"),

  title: {
    default: "Ninzo Versus | Competitive Tournaments & Global Player Rankings",
    template: "%s | Ninzo Versus",
  },

  description:
    "Ninzo Versus is a competitive player platform for tournaments, challenges, seasonal global rankings, events, achievements, and player showcases.",

  keywords: [
    "Ninzo Versus",
    "Ninzo",
    "competitive tournaments",
    "esports tournaments",
    "competitive gaming",
    "global player rankings",
    "seasonal rankings",
    "player showcase",
    "competitive events",
    "Free Fire MAX tournaments",
    "Free Fire MAX esports",
    "Free Fire tournaments India",
  ],

  applicationName: "Ninzo Versus",
  category: "Esports",

  alternates: {
    canonical: "/",
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        url: "/nv.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/nv.jpg",
        sizes: "1024x1024",
        type: "image/jpeg",
      },
    ],
  },

  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Ninzo Versus",
    title: "Ninzo Versus | Competitive Tournaments & Global Player Rankings",
    description:
      "Compete in tournaments and challenges, follow seasonal global rankings, earn achievements, and showcase your competitive profile on Ninzo Versus.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Ninzo Versus — Competitive Player Platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Ninzo Versus | Competitive Tournaments & Global Player Rankings",
    description:
      "Compete, climb seasonal global rankings, earn achievements, and showcase your competitive profile on Ninzo Versus.",
    images: ["/og-image.jpg"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <ChatNotificationListener />
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
