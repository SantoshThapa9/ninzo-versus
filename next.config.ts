import path from "path";
import type { NextConfig } from "next";

const capacitorServerUrl = process.env.CAPACITOR_SERVER_URL;
const capacitorDevHost = capacitorServerUrl
  ? new URL(capacitorServerUrl).hostname
  : undefined;

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "10.63.120.238.sslip.io",
    ...(capacitorDevHost ? [capacitorDevHost] : []),
  ],
  sassOptions: {
    includePaths: [path.join(process.cwd(), "src/styles")],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
