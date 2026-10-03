import { headers } from "next/headers";

export async function isLocalDevelopmentRequest() {
  if (process.env.NODE_ENV !== "development") return false;

  const host = (await headers()).get("host")?.toLowerCase();
  return (
    host === "localhost" ||
    host?.startsWith("localhost:") === true ||
    host === "127.0.0.1" ||
    host?.startsWith("127.0.0.1:") === true ||
    host === "[::1]" ||
    host?.startsWith("[::1]:") === true
  );
}
