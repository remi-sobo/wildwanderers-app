import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Ridgeline } from "@/components/brand/Ridgeline";
import { WaiverSignForm } from "@/components/popup/WaiverSignForm";

export const metadata: Metadata = {
  title: "Pop-up waiver · Wild Wanderers",
  robots: { index: false, follow: false },
};

// The page a guest opens from the QR at the table. No account needed. Shows
// only the waiver text for the day's org; the location and everyone else's
// details stay private. Signing runs through sign_popup_waiver.
export default async function PopupSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("popup_waiver_for_token", { p_token: token });
  const form = (data as { starts_at: string; title: string; body: string; version: number; valid_through: string | null }[] | null)?.[0];

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="relative overflow-hidden bg-forest-deep px-4 pb-16 pt-10 text-bone">
        <div className="mx-auto max-w-xl">
          <p className="eyebrow text-[color:var(--color-cream)]">Wild Wanderers Fitness</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-tight">
            Sign in for the pop-up
          </h1>
          <p className="mt-2 text-[15px] text-bone/85">
            One quick form, once a season. Then you are all set.
          </p>
        </div>
        <Ridgeline className="absolute inset-x-0 bottom-0 h-14 w-full" />
      </header>

      <div className="mx-auto max-w-xl px-4 py-6">
        {form ? (
          <WaiverSignForm token={token} title={form.title} body={form.body} />
        ) : (
          <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
            <p className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">This link has closed.</p>
            <p className="mt-2 text-[15px] text-[color:var(--color-text)]">
              Ask Gabe for today&apos;s code at the table, or sign the paper copy.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
