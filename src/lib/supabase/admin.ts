import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key. It bypasses RLS and
// can create auth users, so it must never be imported into a client component
// or exposed to the browser. Used only for admin actions like inviting a client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
