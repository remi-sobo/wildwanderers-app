"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

// Signs a user in with email and password against Supabase auth. On success
// the middleware sends them to their surface; role routing lands later.
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
      // A returned error means the credentials did not match. Keep the reason
      // vague on purpose, and never blame the person.
      return {
        error: "That email and password did not match. Give it another try.",
      };
    }
  } catch {
    // A thrown error means the request never completed (server unreachable,
    // network dropped). Say so plainly rather than blaming the credentials.
    failed = true;
  }

  if (failed) {
    return { error: "We could not reach the server just now. Try again in a moment." };
  }

  revalidatePath("/", "layout");
  // redirect throws NEXT_REDIRECT by design, so it stays outside the try above.
  redirect("/");
}
