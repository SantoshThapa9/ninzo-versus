import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ninzo-versus.com"),
  title: {
    default: "Ninzo Versus | Daily Free Esports Tournaments",
    template: "%s | Ninzo Versus",
  },
  description:
    "Join daily free esports tournaments and competitive 1v1 challenges on Ninzo Versus, a skill-based gaming platform for Free Fire players in India.",
  keywords: [
    "daily free esports tournaments",
    "skill-based gaming",
    "competitive 1v1 challenges",
    "Free Fire tournaments India",
    "redeem gaming rewards",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Ninzo Versus",
    title: "Ninzo Versus | Daily Free Esports Tournaments",
    description: "Skill-based gaming with daily free esports tournaments and competitive 1v1 challenges.",
  },
  twitter: {
    card: "summary",
    title: "Ninzo Versus | Daily Free Esports Tournaments",
    description: "Skill-based gaming with daily free esports tournaments and competitive 1v1 challenges.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
