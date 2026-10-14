import { createHash } from "node:crypto";
import type { User } from "next-auth";
import { connectDb } from "@/lib/db/mongoose";
import { AndroidAuthHandoffModel } from "@/models/android-auth-handoff";
import { userRepository } from "@/repositories/user.repository";

const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

export async function redeemAndroidGoogleHandoff(
  credentials: Partial<Record<"code" | "verifier", unknown>>,
): Promise<User | null> {
  const code = typeof credentials.code === "string" ? credentials.code : "";
  const verifier =
    typeof credentials.verifier === "string" ? credentials.verifier : "";

  if (!BASE64URL_32_BYTES.test(code) || !BASE64URL_32_BYTES.test(verifier)) {
    return null;
  }

  const codeChallenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  await connectDb();
  const handoff = await AndroidAuthHandoffModel.findOneAndDelete({
    ticketHash: createHash("sha256").update(code).digest("hex"),
    codeChallenge,
    expiresAt: { $gt: new Date() },
  });

  if (!handoff) return null;

  const user = await userRepository.findById(String(handoff.userId));
  if (!user) return null;

  return {
    id: String(user._id),
    email: user.email,
    name: user.displayName,
    role: user.role,
  };
}
