"use client";

// Roll call on the morning of a pop-up, built for one hand on a phone in a
// park. One big Here toggle per person, a search box, the waiver and the
// bring-a-friend count on each row, and an Add someone button (top and
// bottom of the list) for walk-ups. Tap a row for the rest: who they came with, the free session,
// and the waiver on file. Taps update the screen first and save behind it;
// a failed save puts the row back and says so.

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, QrCode, Search, UserPlus, X } from "lucide-react";
import {
  addWalkUp,
  markPaperWaiver,
  setCameWith,
  setFreeSession,
  setHere,
  updatePopupLocation,
  type WalkUpInput,
} from "@/lib/popup/actions";
import type { RollCall as RollCallData, RollRow } from "@/lib/data/popup";

const field =
  "h-12 w-full rounded-xl border border-[color:var(--border-strong)] bg-card px-3.5 text-[16px] text-ink outline-none focus:border-amber";
const label = "mb-1.5 block text-[13px] font-semibold text-[color:var(--color-text)]";

const FRIENDS_FOR_FREE = 2;

function displayName(r: RollRow) {
  return r.name || r.email;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[rgba(30,51,31,0.45)]" />
      <div
        role="dialog"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-canvas p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(42,33,24,0.18)] md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-[21px] leading-tight text-forest-deep">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inset text-forest"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WaiverChip({ row }: { row: RollRow }) {
  return row.waiver ? (
    <span className="rounded-full bg-[rgba(95,154,79,0.16)] px-2.5 py-1 text-[11.5px] font-semibold text-forest">
      Waiver on file
    </span>
  ) : (
    <span className="rounded-full bg-[rgba(217,138,58,0.18)] px-2.5 py-1 text-[11.5px] font-semibold text-amber-deep">
      Needs waiver
    </span>
  );
}

export function RollCall({ data }: { data: RollCallData }) {
  const router = useRouter();
  const [rows, setRows] = useState<RollRow[]>(data.rows);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setRows(data.rows), [data.rows]);

  const hereRows = rows.filter((r) => r.here);
  const signedHere = hereRows.filter((r) => r.waiver).length;
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const match = (r: RollRow) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    return {
      here: rows.filter((r) => r.here && match(r)),
      notHere: rows.filter((r) => !r.here && match(r)),
    };
  }, [rows, q]);
  const open = rows.find((r) => r.key === openKey) ?? null;

  // Optimistic: change the row now, save, and put it back if the save fails.
  function run(change: (rs: RollRow[]) => RollRow[], save: () => Promise<{ error: string | null }>) {
    const before = rows;
    setRows(change(rows));
    setError(null);
    startTransition(async () => {
      const res = await save();
      if (res.error) {
        setRows(before);
        setError(res.error);
      }
      router.refresh();
    });
  }

  function toggleHere(r: RollRow) {
    const next = !r.here;
    run(
      (rs) =>
        rs.map((x) =>
          x.key === r.key
            ? { ...x, here: next, broughtBy: next ? x.broughtBy : null, free: next ? x.free : false }
            : !next && x.broughtBy === r.guestId
              ? { ...x, broughtBy: null }
              : x,
        ),
      () => setHere(data.day.id, { guestId: r.guestId, subscriberId: r.subscriberId }, next),
    );
  }

  function changeCameWith(r: RollRow, broughtBy: string | null) {
    if (!r.guestId) return;
    const guestId = r.guestId;
    run(
      (rs) => {
        const updated = rs.map((x) => (x.key === r.key ? { ...x, broughtBy } : x));
        // Recount friends from the new links.
        const counts = new Map<string, number>();
        for (const x of updated) if (x.here && x.broughtBy) counts.set(x.broughtBy, (counts.get(x.broughtBy) ?? 0) + 1);
        return updated.map((x) => ({ ...x, friends: x.guestId ? counts.get(x.guestId) ?? 0 : 0 }));
      },
      () => setCameWith(data.day.id, guestId, broughtBy),
    );
  }

  function toggleFree(r: RollRow) {
    if (!r.guestId) return;
    const guestId = r.guestId;
    run(
      (rs) => rs.map((x) => (x.key === r.key ? { ...x, free: !r.free } : x)),
      () => setFreeSession(data.day.id, guestId, !r.free),
    );
  }

  function paperWaiver(r: RollRow) {
    if (!r.guestId) return;
    const guestId = r.guestId;
    run(
      (rs) =>
        rs.map((x) =>
          x.key === r.key
            ? {
                ...x,
                waiver: {
                  signed_via: "paper",
                  signed_at: new Date().toISOString(),
                  signed_name: null,
                  guardian_name: null,
                  guardian_relationship: null,
                  emergency_name: null,
                  emergency_phone: null,
                  photo_ok: null,
                },
              }
            : x,
        ),
      () => markPaperWaiver(data.day.id, guestId),
    );
  }

  const nameOf = (guestId: string | null) => {
    const r = rows.find((x) => x.guestId === guestId);
    return r ? displayName(r) : "";
  };

  function Row({ r }: { r: RollRow }) {
    const earned = r.friends >= FRIENDS_FOR_FREE;
    return (
      <li className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={() => toggleHere(r)}
          aria-pressed={r.here}
          aria-label={r.here ? `${displayName(r)} is here. Tap to undo.` : `Mark ${displayName(r)} here`}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 transition-colors ${
            r.here ? "border-forest bg-forest text-bone" : "border-[color:var(--border-strong)] bg-card text-[color:var(--color-text-faint)]"
          }`}
        >
          <Check size={26} strokeWidth={r.here ? 2.6 : 2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setOpenKey(r.key)}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center gap-1 text-left"
        >
          <span className="w-full truncate text-[15.5px] font-medium text-forest-deep">
            {displayName(r)}
            {r.age !== null ? <span className="font-normal text-[color:var(--color-text-muted)]"> · {r.age}</span> : null}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <WaiverChip row={r} />
            {r.here && r.broughtBy ? (
              <span className="text-[12px] text-[color:var(--color-text-muted)]">with {nameOf(r.broughtBy)}</span>
            ) : null}
            {r.free ? (
              <span className="rounded-full bg-forest px-2.5 py-1 text-[11.5px] font-semibold text-bone">Free today</span>
            ) : earned ? (
              <span className="rounded-full bg-amber px-2.5 py-1 text-[11.5px] font-semibold text-[#23170c]">
                Brought {r.friends}, session free
              </span>
            ) : r.friends > 0 ? (
              <span className="text-[12px] text-[color:var(--color-text-muted)]">brought {r.friends}</span>
            ) : null}
          </span>
        </button>
      </li>
    );
  }

  const dateLabel = mounted
    ? new Date(data.day.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "";

  const addButton = (
    <button
      type="button"
      onClick={() => setShowAdd(true)}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-amber text-[16px] font-semibold text-[#23170c] shadow-[var(--shadow-card)] transition-colors hover:bg-amber-deep"
    >
      <UserPlus size={20} aria-hidden="true" /> Add someone
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/business/popup?list=days" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13.5px] font-semibold text-forest">
        <ArrowLeft size={16} aria-hidden="true" /> Pop-up days
      </Link>

      <section className="rounded-2xl bg-forest-deep p-5 text-bone shadow-[var(--shadow-card)]">
        <p className="eyebrow text-[color:var(--color-cream)]">Roll call</p>
        <p className="mt-1 min-h-[32px] font-[family-name:var(--font-display)] text-[26px] leading-tight">{dateLabel}</p>
        <LocationLine dayId={data.day.id} location={data.day.location} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[rgba(246,241,231,0.08)] p-3">
            <p className="font-[family-name:var(--font-display)] text-[28px] leading-none">{hereRows.length}</p>
            <p className="mt-1 text-[12.5px] text-bone/75">here, {data.onList} on the pop-up list</p>
          </div>
          <div className="rounded-xl bg-[rgba(246,241,231,0.08)] p-3">
            <p className="font-[family-name:var(--font-display)] text-[28px] leading-none">
              {signedHere}
              <span className="text-[18px] text-bone/60"> of {hereRows.length}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-bone/75">waivers on file</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-bone/30 text-[15px] font-semibold text-bone"
        >
          <QrCode size={18} aria-hidden="true" /> Show the waiver QR
        </button>
      </section>

      {addButton}

      <label className="relative block">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-faint)]" aria-hidden="true" />
        <input
          className={`${field} pl-10`}
          placeholder="Find someone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find someone"
        />
      </label>

      {error ? (
        <p role="alert" className="rounded-xl bg-[rgba(180,71,46,0.1)] px-4 py-3 text-[14px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}

      {visible.here.length > 0 ? (
        <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-2 shadow-[var(--shadow-card)]">
          <p className="eyebrow pt-2 text-bark">Here</p>
          <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
            {visible.here.map((r) => (
              <Row key={r.key} r={r} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-2 shadow-[var(--shadow-card)]">
        <p className="eyebrow pt-2 text-bark">{hereRows.length > 0 ? "Not here yet" : "On the list"}</p>
        {visible.notHere.length === 0 ? (
          <p className="py-4 text-[14px] text-[color:var(--color-text-muted)]">
            {q ? "No one by that name. Add them below." : "Everyone on the list is here."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
            {visible.notHere.map((r) => (
              <Row key={r.key} r={r} />
            ))}
          </ul>
        )}
      </section>

      {addButton}

      {open ? (
        <Sheet title={displayName(open)} onClose={() => setOpenKey(null)}>
          <DetailBody
            row={open}
            hereRows={hereRows}
            waiverReady={data.waiverReady}
            onHere={() => toggleHere(open)}
            onCameWith={(id) => changeCameWith(open, id)}
            onFree={() => toggleFree(open)}
            onPaper={() => paperWaiver(open)}
          />
        </Sheet>
      ) : null}

      {showQr ? (
        <Sheet title="Sign in on your phone" onClose={() => setShowQr(false)}>
          <p className="text-[14.5px] text-[color:var(--color-text)]">
            Hold this up at the table. Guests scan it, read the waiver, and sign. Signing today checks them in too.
          </p>
          <div
            className="mx-auto mt-4 w-full max-w-[300px] rounded-2xl bg-card p-3 [&>svg]:h-auto [&>svg]:w-full"
            // The SVG is generated on the server from this day's own link.
            dangerouslySetInnerHTML={{ __html: data.signQrSvg }}
          />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(data.signUrl)}
            className="mt-4 h-12 w-full rounded-full border border-[color:var(--border-strong)] text-[15px] font-semibold text-forest"
          >
            Copy the link
          </button>
          <p className="mt-2 break-all text-center text-[12px] text-[color:var(--color-text-faint)]">{data.signUrl}</p>
          {!data.waiverReady ? (
            <p className="mt-3 text-[13.5px] text-[color:var(--color-state-caution)]">
              The pop-up waiver is not set up yet, so the link will ask guests to sign on paper.
            </p>
          ) : null}
        </Sheet>
      ) : null}

      {showAdd ? (
        <Sheet title="Add someone" onClose={() => setShowAdd(false)}>
          <WalkUpForm
            dayId={data.day.id}
            hereRows={hereRows}
            onDone={() => {
              setShowAdd(false);
              router.refresh();
            }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function LocationLine({ dayId, location }: { dayId: string; location: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(location ?? "");
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="mt-1 min-h-11 text-left text-[14px] text-bone/80 underline-offset-4 hover:underline">
        {location ?? "Add the spot"}
      </button>
    );
  }
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await updatePopupLocation(dayId, value);
          setEditing(false);
          router.refresh();
        });
      }}
    >
      <input
        autoFocus
        className="h-11 min-w-0 flex-1 rounded-lg border border-bone/30 bg-transparent px-3 text-[16px] text-bone outline-none focus:border-amber"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Location"
      />
      <button type="submit" disabled={pending} className="h-11 rounded-lg bg-amber px-4 text-[14px] font-semibold text-[#23170c]">
        Save
      </button>
    </form>
  );
}

function DetailBody({
  row,
  hereRows,
  waiverReady,
  onHere,
  onCameWith,
  onFree,
  onPaper,
}: {
  row: RollRow;
  hereRows: RollRow[];
  waiverReady: boolean;
  onHere: () => void;
  onCameWith: (id: string | null) => void;
  onFree: () => void;
  onPaper: () => void;
}) {
  const others = hereRows.filter((r) => r.guestId && r.guestId !== row.guestId);
  const w = row.waiver;
  return (
    <div className="flex flex-col gap-5">
      <p className="-mt-2 break-all text-[13.5px] text-[color:var(--color-text-muted)]">
        {row.email}
        {row.phone ? ` · ${row.phone}` : ""}
        {row.age !== null ? ` · age ${row.age}` : ""}
      </p>

      <button
        type="button"
        onClick={onHere}
        className={`h-14 w-full rounded-full text-[16px] font-semibold ${
          row.here ? "border border-[color:var(--border-strong)] text-forest" : "bg-forest text-bone"
        }`}
      >
        {row.here ? "Not here after all" : "Mark here"}
      </button>

      {row.here && row.guestId ? (
        <div>
          <label className={label} htmlFor="came-with">Came with</label>
          <select
            id="came-with"
            className={field}
            value={row.broughtBy ?? ""}
            onChange={(e) => onCameWith(e.target.value || null)}
          >
            <option value="">No one, or not sure</option>
            {others.map((o) => (
              <option key={o.guestId!} value={o.guestId!}>
                {displayName(o)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {row.here && row.guestId ? (
        <div className="rounded-2xl bg-inset p-4">
          <p className="text-[14.5px] text-forest-deep">
            Brought {row.friends} {row.friends === 1 ? "friend" : "friends"} today.
            {row.friends >= FRIENDS_FOR_FREE ? " That earns a free session." : ` ${FRIENDS_FOR_FREE} earns a free session.`}
          </p>
          <button
            type="button"
            onClick={onFree}
            aria-pressed={row.free}
            className={`mt-3 h-12 w-full rounded-full text-[15px] font-semibold ${
              row.free ? "bg-forest text-bone" : "border border-[color:var(--border-strong)] bg-card text-forest"
            }`}
          >
            {row.free ? "Free today ✓" : "Make today free"}
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14.5px] font-semibold text-forest-deep">Waiver</p>
          <WaiverChip row={row} />
        </div>
        {w ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
            <dt className="text-[color:var(--color-text-muted)]">Signed</dt>
            <dd className="text-ink">
              {w.signed_via === "paper" ? "On paper" : "On their phone"},{" "}
              {new Date(w.signed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </dd>
            {w.signed_name ? (
              <>
                <dt className="text-[color:var(--color-text-muted)]">Signed by</dt>
                <dd className="text-ink">
                  {w.signed_name}
                  {w.guardian_relationship ? ` (${w.guardian_relationship})` : ""}
                </dd>
              </>
            ) : null}
            {w.emergency_name ? (
              <>
                <dt className="text-[color:var(--color-text-muted)]">Emergency</dt>
                <dd className="text-ink">
                  {w.emergency_name}
                  {w.emergency_phone ? (
                    <>
                      {" · "}
                      <a className="text-forest underline" href={`tel:${w.emergency_phone}`}>{w.emergency_phone}</a>
                    </>
                  ) : null}
                </dd>
              </>
            ) : null}
            {w.photo_ok !== null ? (
              <>
                <dt className="text-[color:var(--color-text-muted)]">Photos</dt>
                <dd className="text-ink">{w.photo_ok ? "Okay" : "No photos"}</dd>
              </>
            ) : null}
          </dl>
        ) : row.guestId && waiverReady ? (
          <button
            type="button"
            onClick={onPaper}
            className="mt-3 h-12 w-full rounded-full border border-[color:var(--border-strong)] text-[15px] font-semibold text-forest"
          >
            They signed the paper copy
          </button>
        ) : (
          <p className="mt-2 text-[13.5px] text-[color:var(--color-text-muted)]">
            {waiverReady ? "Mark them here first, then record a paper waiver, or have them scan the QR." : "The pop-up waiver is not set up yet."}
          </p>
        )}
      </div>
    </div>
  );
}

function WalkUpForm({ dayId, hereRows, onDone }: { dayId: string; hereRows: RollRow[]; onDone: () => void }) {
  const [f, setF] = useState<WalkUpInput>({
    name: "",
    email: "",
    phone: "",
    age: "",
    cameWith: null,
    joinList: false,
    paperWaiver: false,
  });
  const [minor, setMinor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof WalkUpInput>(k: K, v: WalkUpInput[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addWalkUp(dayId, { ...f, age: minor ? f.age : "" });
          if (res.error) setError(res.error);
          else onDone();
        });
      }}
    >
      <div>
        <label className={label} htmlFor="wu-name">Name</label>
        <input id="wu-name" className={field} autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className={label} htmlFor="wu-email">{minor ? "Parent or guardian email" : "Email"}</label>
        <input id="wu-email" className={field} type="email" inputMode="email" value={f.email}
          onChange={(e) => set("email", e.target.value)} />
      </div>
      <div>
        <label className={label} htmlFor="wu-phone">Phone (optional)</label>
        <input id="wu-phone" className={field} type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-[15px] text-ink">
        <input type="checkbox" className="h-5 w-5 accent-[color:var(--color-forest)]" checked={minor}
          onChange={(e) => setMinor(e.target.checked)} />
        Under 18
      </label>
      {minor ? (
        <div>
          <label className={label} htmlFor="wu-age">Age (10 and up)</label>
          <input id="wu-age" className={field} inputMode="numeric" value={f.age}
            onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
      ) : null}
      {hereRows.some((r) => r.guestId) ? (
        <div>
          <label className={label} htmlFor="wu-with">Came with</label>
          <select id="wu-with" className={field} value={f.cameWith ?? ""} onChange={(e) => set("cameWith", e.target.value || null)}>
            <option value="">No one, or not sure</option>
            {hereRows
              .filter((r) => r.guestId)
              .map((r) => (
                <option key={r.guestId!} value={r.guestId!}>
                  {displayName(r)}
                </option>
              ))}
          </select>
        </div>
      ) : null}
      <label className="flex min-h-12 items-center gap-3 text-[15px] text-ink">
        <input type="checkbox" className="h-5 w-5 accent-[color:var(--color-forest)]" checked={f.joinList}
          onChange={(e) => set("joinList", e.target.checked)} />
        They said yes to the pop-up email list
      </label>
      <label className="flex min-h-12 items-center gap-3 text-[15px] text-ink">
        <input type="checkbox" className="h-5 w-5 accent-[color:var(--color-forest)]" checked={f.paperWaiver}
          onChange={(e) => set("paperWaiver", e.target.checked)} />
        They signed the paper waiver
      </label>
      {error ? <p role="alert" className="text-[14px] text-[color:var(--color-state-error)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-14 w-full rounded-full bg-amber text-[16px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
      >
        {pending ? "Adding..." : "Add and mark here"}
      </button>
    </form>
  );
}
