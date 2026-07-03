"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

// Signs a user in with email and password against Supabase auth. On success
// the root route sends them to their surface by role.
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password to sign in." };
  }

  const supabase = await createClient();

  let failed = false;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Only an actual credential mismatch should point at the email and
      // password, and even then never blame the person. Anything else (a
      // server error, rate limit, unreachable host) gets the generic message
      // so we do not wrongly tell someone their password is wrong.
      const badCredentials =
        error.code === "invalid_credentials" || error.status === 400;
      if (badCredentials) {
        return {
          error: "That email and password did not match. Give it another try.",
        };
      }
      failed = true;
    }
  } catch {
    // A thrown error means the request never completed (server unreachable,
    // network dropped).
    failed = true;
  }

  if (failed) {
    return { error: "We could not reach the server just now. Try again in a moment." };
  }

  revalidatePath("/", "layout");
  // redirect throws NEXT_REDIRECT by design, so it stays outside the try above.
  redirect("/");
}
