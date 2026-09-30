import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/clash/", "/events/", "/inventory/", "/matches/", "/profile/", "/support/", "/wallet/"],
    },
    sitemap: "https://ninzo-versus.vercel.app/sitemap.xml",
    host: "https://ninzo-versus.vercel.app",
  };
}
