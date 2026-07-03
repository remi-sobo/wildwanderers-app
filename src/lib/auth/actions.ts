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

  // TEMP diagnostic: no secrets, only presence + host + error shape. Remove
  // once the production sign-in issue is resolved.
  const diag = () => {
    let host = "unset";
    try {
      host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || "empty";
    } catch {
      host = "invalid-url";
    }
    return {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      urlHost: host,
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      anonKeyLen: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length,
    };
  };

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
      console.error("[login] supabase returned error", {
        status: error.status,
        code: error.code,
        message: error.message,
        ...diag(),
      });
      failed = true;
    }
  } catch (e) {
    // A thrown error means the request never completed (server unreachable,
    // network dropped).
    console.error("[login] sign-in threw", {
      err: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      ...diag(),
    });
    failed = true;
  }

  if (failed) {
    return { error: "We could not reach the server just now. Try again in a moment." };
  }

  revalidatePath("/", "layout");
  // redirect throws NEXT_REDIRECT by design, so it stays outside the try above.
  redirect("/");
}
