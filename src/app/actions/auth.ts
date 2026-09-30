"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { registerUser } from "@/services/auth.service";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function registerAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    await rateLimit("auth:register", 8, 60);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "");
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    await registerUser(email, password, displayName);
    await signIn("credentials", { email, password, redirectTo: "/" });
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    await rateLimit("auth:login", 12, 60);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    await signIn("credentials", { email, password, redirectTo: "/" });
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
  redirect("/");
}
