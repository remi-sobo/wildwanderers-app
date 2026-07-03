"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Base URL for the recovery link. Prefers the configured app URL, falls back to
// the request host so previews and local runs work too.
async function getOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "app.wildwanderers.life";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type ResetRequestState = { sent: boolean; error: string | null };

// Sends a password reset email. Always reports success so we never reveal which
// addresses have accounts.
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { sent: false, error: "Enter your email so we can send the reset link." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  try {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  } catch {
    // Swallow delivery errors on purpose: the response looks the same whether
    // or not the address exists.
  }

  return { sent: true, error: null };
}

export type UpdatePasswordState = { error: string | null };

// Sets a new password for the user in the current recovery session.
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Use at least 8 characters for your new password." };
  }
  if (password !== confirm) {
    return { error: "Those two passwords do not match. Give it another look." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let failed = false;
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { error: "We could not update your password. Try again in a moment." };
    }
  } catch {
    failed = true;
  }

  if (failed) {
    return { error: "We could not reach the server just now. Try again in a moment." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
