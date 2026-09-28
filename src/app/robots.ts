import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/clash/", "/events/", "/inventory/", "/lobby/", "/matches/", "/profile/", "/support/", "/wallet/"],
    },
    sitemap: "https://ninzo-versus.com/sitemap.xml",
  };
}
