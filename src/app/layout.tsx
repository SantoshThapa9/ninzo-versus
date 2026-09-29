import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ninzo-versus.vercel.app"),
  title: {
    default: "Ninzo Versus | Garena Free Fire MAX Tournaments & Esports",
    template: "%s | Ninzo Versus",
  },
  description:
    "Join Ninzo Versus for free Garena Free Fire MAX tournaments, esports challenges, and competitive 1v1 matches for players in India.",
  keywords: [
    "Ninzo Versus",
    "Garena Free Fire MAX tournament",
    "Free Fire MAX tournament India",
    "Free Fire MAX esports",
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
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/nv.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/nv.jpg", sizes: "1024x1024", type: "image/jpeg" }],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Ninzo Versus",
    title: "Ninzo Versus | Garena Free Fire MAX Tournaments & Esports",
    description:
      "Free Garena Free Fire MAX tournaments, esports challenges, and competitive 1v1 matches for players in India.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ninzo Versus | Garena Free Fire MAX Tournaments & Esports",
    description:
      "Free Garena Free Fire MAX tournaments, esports challenges, and competitive 1v1 matches for players in India.",
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
