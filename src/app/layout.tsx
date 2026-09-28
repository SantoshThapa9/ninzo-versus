import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ninzo-versus.vercel.app"),
  title: {
    default: "Ninzo Versus | Free Fire Tournaments & 1v1 Challenges",
    template: "%s | Ninzo Versus",
  },
  description:
    "Join Ninzo Versus for free Free Fire tournaments, esports challenges, and competitive 1v1 matches for players in India.",
  keywords: [
    "Ninzo Versus",
    "Free Fire tournament",
    "free Free Fire tournament",
    "Free Fire 1v1",
    "esports free",
    "esports challenge",
    "1v1 challenge",
    "Free Fire tournaments India",
  ],
  applicationName: "Ninzo Versus",
  category: "Esports",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Ninzo Versus",
    title: "Ninzo Versus | Free Fire Tournaments & 1v1 Challenges",
    description: "Free Free Fire tournaments, esports challenges, and competitive 1v1 matches for players in India.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ninzo Versus | Free Fire Tournaments & 1v1 Challenges",
    description: "Free Free Fire tournaments, esports challenges, and competitive 1v1 matches for players in India.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
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
