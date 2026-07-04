"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Users, CalendarClock, CircleCheck, Award, Check, Sparkles } from "lucide-react";
import {
  addGroup,
  addParticipant,
  moveParticipant,
  addSession,
  markAttendance,
  awardBadge,
  recordExperience,
  inviteParent,
  type ParticipantInput,
  type SessionInput,
} from "@/lib/boys/actions";
import type { ProgramDetail as Detail, Participant, ProgramGroup, EarnedExperience } from "@/lib/data/boys";
import { BAND_DOT } from "@/components/longevity/LongevityBits";
import { FamiliesTab } from "@/components/coach/FamiliesTab";

const field = "h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";
const TABS = ["Families", "Roster", "Schedule", "Attendance", "Badges", "Experiences"] as const;
type Tab = (typeof TABS)[number];

function fullName(p: Participant) {
  return `${p.first_name} ${p.last_name}`.trim();
}
function whenLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InviteFamily({ programId, participantId }: { programId: string; participantId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function invite() {
    setErr(null);
    start(async () => {
      const res = await inviteParent(programId, participantId);
      if (res.error) setErr(res.error);
      else router.refresh();
    });
  }
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={invite} disabled={pending}
        className="rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60">
        {pending ? "Inviting" : "Invite family"}
      </button>
      {err ? <span className="max-w-[220px] text-[11.5px] text-[color:var(--color-state-error)]">{err}</span> : null}
    </span>
  );
}

// ── Roster ──────────────────────────────────────────────────
function RosterTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [p, setP] = useState<ParticipantInput>({ first_name: "", last_name: "" });
  const [cohort, setCohort] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const groupName = (id: string | null) =>
    id ? detail.groups.find((g) => g.id === id)?.name ?? "Cohort" : "No cohort";

  function saveParticipant() {
    setErr(null);
    start(async () => {
      const res = await addParticipant(detail.program.id, p);
      if (res.error) setErr(res.error);
      else { setP({ first_name: "", last_name: "" }); setShowAdd(false); router.refresh(); }
    });
  }
  function saveCohort() {
    if (!cohort.trim()) return;
    start(async () => {
      await addGroup(detail.program.id, cohort);
      setCohort("");
      router.refresh();
    });
  }
  function move(participantId: string, groupId: string) {
    start(async () => { await moveParticipant(detail.program.id, participantId, groupId || null); router.refresh(); });
  }

  const byGroup = new Map<string | null, Participant[]>();
  for (const part of detail.participants) {
    const arr = byGroup.get(part.group_id) ?? [];
    arr.push(part);
    byGroup.set(part.group_id, arr);
  }
  const sections: (string | null)[] = [...detail.groups.map((g) => g.id), null].filter(
    (id) => (byGroup.get(id)?.length ?? 0) > 0 || id !== null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep">
          <Plus size={15} /> Add a kid
        </button>
        <div className="flex items-center gap-2">
          <input className={`${field} w-40`} placeholder="New cohort" value={cohort}
            onChange={(e) => setCohort(e.target.value)} />
          <button type="button" onClick={saveCohort} disabled={!cohort.trim()}
            className="rounded-full border border-[color:var(--border-strong)] px-3 py-2 text-[13px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60">
            Add cohort
          </button>
        </div>
      </div>

      {showAdd ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={field} placeholder="First name" value={p.first_name}
              onChange={(e) => setP({ ...p, first_name: e.target.value })} />
            <input className={field} placeholder="Last name" value={p.last_name}
              onChange={(e) => setP({ ...p, last_name: e.target.value })} />
            <input className={field} inputMode="numeric" placeholder="Grade (1 to 12)" value={p.grade ?? ""}
              onChange={(e) => setP({ ...p, grade: e.target.value })} />
            <select className={field} value={p.group_id ?? ""} onChange={(e) => setP({ ...p, group_id: e.target.value })}>
              <option value="">No cohort</option>
              {detail.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input className={field} placeholder="Parent name" value={p.parent_name ?? ""}
              onChange={(e) => setP({ ...p, parent_name: e.target.value })} />
            <input className={field} placeholder="Parent email" value={p.parent_email ?? ""}
              onChange={(e) => setP({ ...p, parent_email: e.target.value })} />
            <input className={`${field} sm:col-span-2`} placeholder="Parent phone" value={p.parent_phone ?? ""}
              onChange={(e) => setP({ ...p, parent_phone: e.target.value })} />
          </div>
          {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={saveParticipant} disabled={pending || !p.first_name.trim() || !p.last_name.trim()}
              className="rounded-full bg-amber px-5 py-2 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70">
              {pending ? "Adding" : "Add to roster"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="ww-link text-[13.5px] font-semibold text-forest">Cancel</button>
          </div>
        </div>
      ) : null}

      {detail.participants.length === 0 ? (
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
          No kids on the roster yet. Add a cohort, then add kids to it.
        </p>
      ) : (
        sections.map((gid) => {
          const kids = byGroup.get(gid) ?? [];
          if (kids.length === 0) return null;
          return (
            <section key={gid ?? "none"}>
              <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                {groupName(gid)} <span className="text-[color:var(--color-text-faint)]">· {kids.length}</span>
              </h3>
              <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 shadow-[var(--shadow-card)]">
                {kids.map((kid) => (
                  <li key={kid.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] text-forest-deep">
                        {fullName(kid)}
                        {kid.grade ? <span className="text-[12px] text-[color:var(--color-text-faint)]"> · grade {kid.grade}</span> : null}
                        {kid.parent_user_id ? <span className="ml-2 text-[11px] font-semibold text-fern">family linked</span> : null}
                      </p>
                      {kid.parent_name || kid.parent_email ? (
                        <p className="truncate text-[12px] text-[color:var(--color-text-muted)]">
                          {kid.parent_name}{kid.parent_email ? ` · ${kid.parent_email}` : ""}
                        </p>
                      ) : null}
                    </div>
                    {!kid.parent_user_id && kid.parent_email ? (
                      <InviteFamily programId={detail.program.id} participantId={kid.id} />
                    ) : null}
                    <select value={kid.group_id ?? ""} onChange={(e) => move(kid.id, e.target.value)}
                      className="h-9 rounded-lg border border-[color:var(--border-strong)] bg-canvas px-2 text-[13px] text-ink">
                      <option value="">No cohort</option>
                      {detail.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

// ── Schedule ────────────────────────────────────────────────
function ScheduleTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [s, setS] = useState<SessionInput>({ title: "", starts_at: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await addSession(detail.program.id, s);
      if (res.error) setErr(res.error);
      else { setS({ title: "", starts_at: "" }); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={`${field} sm:col-span-2`} placeholder="Session title, e.g. Tuesday Trail Time" value={s.title}
            onChange={(e) => setS({ ...s, title: e.target.value })} />
          <label className="text-[12px] text-bark">Starts
            <input type="datetime-local" className={`${field} mt-1 w-full`} value={s.starts_at}
              onChange={(e) => setS({ ...s, starts_at: e.target.value })} /></label>
          <label className="text-[12px] text-bark">Ends (optional)
            <input type="datetime-local" className={`${field} mt-1 w-full`} value={s.ends_at ?? ""}
              onChange={(e) => setS({ ...s, ends_at: e.target.value })} /></label>
          <input className={`${field} sm:col-span-2`} placeholder="Location (optional)" value={s.location ?? ""}
            onChange={(e) => setS({ ...s, location: e.target.value })} />
        </div>
        {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
        <button type="button" onClick={save} disabled={pending || !s.title.trim() || !s.starts_at}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70">
          <Plus size={15} /> Add session
        </button>
      </div>

      {detail.sessions.length === 0 ? (
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">No sessions scheduled yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 shadow-[var(--shadow-card)]">
          {detail.sessions.map((sess) => (
            <li key={sess.id} className="flex items-center gap-3 py-3">
              <CalendarClock size={16} className="shrink-0 text-forest" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[14px] text-forest-deep">{sess.title}
                {sess.location ? <span className="text-[12px] text-[color:var(--color-text-muted)]"> · {sess.location}</span> : null}
              </span>
              <span className="shrink-0 text-[12.5px] text-[color:var(--color-text-muted)]">{whenLabel(sess.starts_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Attendance ──────────────────────────────────────────────
function AttendanceTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const upcomingFirst = useMemo(() => [...detail.sessions].reverse(), [detail.sessions]);
  const [sessionId, setSessionId] = useState(upcomingFirst[0]?.id ?? "");

  const marks = useMemo(() => {
    const m: Record<string, "present" | "absent" | "late"> = {};
    for (const a of detail.attendance) if (a.session_id === sessionId) m[a.participant_id] = a.status;
    return m;
  }, [detail.attendance, sessionId]);

  function mark(participantId: string, status: "present" | "absent" | "late") {
    if (!sessionId) return;
    start(async () => { await markAttendance(detail.program.id, sessionId, participantId, status); router.refresh(); });
  }
  function allPresent() {
    if (!sessionId) return;
    start(async () => {
      for (const p of detail.participants) {
        if (marks[p.id] !== "present") await markAttendance(detail.program.id, sessionId, p.id, "present");
      }
      router.refresh();
    });
  }

  if (detail.sessions.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Add a session first, then take attendance for it.</p>;
  }
  if (detail.participants.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Add kids to the roster first.</p>;
  }

  const STATUSES: ("present" | "late" | "absent")[] = ["present", "late", "absent"];
  const STYLE: Record<string, string> = {
    present: "bg-[color:var(--color-state-good)] text-bone",
    late: "bg-[color:var(--color-state-caution)] text-bone",
    absent: "bg-[color:var(--color-state-error)] text-bone",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={`${field} min-w-[240px]`}>
          {upcomingFirst.map((s) => <option key={s.id} value={s.id}>{s.title} · {whenLabel(s.starts_at)}</option>)}
        </select>
        <button type="button" onClick={allPresent} disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60">
          <CircleCheck size={15} /> All present
        </button>
      </div>
      <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 shadow-[var(--shadow-card)]">
        {detail.participants.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[14px] text-forest-deep">{fullName(p)}</span>
            <div className="flex shrink-0 gap-1">
              {STATUSES.map((st) => (
                <button key={st} type="button" onClick={() => mark(p.id, st)} disabled={pending}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
                    marks[p.id] === st ? STYLE[st] : "bg-inset text-[color:var(--color-text-muted)] hover:bg-sand"
                  }`}>
                  {st}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Badges ──────────────────────────────────────────────────
function BadgesTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState(detail.participants[0]?.id ?? "");
  const [badgeId, setBadgeId] = useState(detail.badges[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function give() {
    if (!participantId || !badgeId) return;
    setErr(null); setSaved(false);
    start(async () => {
      const res = await awardBadge(detail.program.id, participantId, badgeId, note);
      if (res.error) setErr(res.error);
      else { setNote(""); setSaved(true); router.refresh(); }
    });
  }

  const awardsByKid = new Map<string, typeof detail.awards>();
  for (const a of detail.awards) {
    const arr = awardsByKid.get(a.participant_id) ?? [];
    arr.push(a);
    awardsByKid.set(a.participant_id, arr);
  }

  if (detail.participants.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Add kids to the roster first, then award badges.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <select className={field} value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
            {detail.participants.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
          <select className={field} value={badgeId} onChange={(e) => setBadgeId(e.target.value)}>
            {detail.badges.map((b) => <option key={b.id} value={b.id}>{b.emoji ? `${b.emoji} ` : ""}{b.name}</option>)}
          </select>
          <input className={field} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={give} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70">
            <Award size={15} /> Award badge
          </button>
          {saved ? <span className="flex items-center gap-1 text-[13px] text-fern"><Check size={15} /> Awarded</span> : null}
          {err ? <span className="text-[13px] text-[color:var(--color-state-error)]">{err}</span> : null}
        </div>
      </div>

      {detail.awards.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {detail.participants.filter((p) => (awardsByKid.get(p.id)?.length ?? 0) > 0).map((p) => (
            <li key={p.id} className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-[14px] font-semibold text-forest-deep">{fullName(p)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(awardsByKid.get(p.id) ?? []).map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3 py-1 text-[12.5px] text-forest-deep" title={a.note ?? undefined}>
                    <span aria-hidden="true">{a.badge_emoji ?? "🏅"}</span> {a.badge_name}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── Experiences (the boys' earned movements) ────────────────
function ExperiencesTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState(detail.participants[0]?.id ?? "");
  const [assessmentId, setAssessmentId] = useState(detail.experiences[0]?.assessmentId ?? "");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const selected = detail.experiences.find((e) => e.assessmentId === assessmentId) ?? null;
  const unitFor = new Map(detail.experiences.map((e) => [e.assessmentId, e.unit] as const));

  function record() {
    if (!participantId || !assessmentId) return;
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await recordExperience(detail.program.id, participantId, assessmentId, value);
      if (res.error) setErr(res.error);
      else {
        setValue("");
        setSaved(true);
        router.refresh();
      }
    });
  }

  const earnedByKid = new Map<string, EarnedExperience[]>();
  for (const e of detail.earned) {
    const arr = earnedByKid.get(e.participant_id) ?? [];
    arr.push(e);
    earnedByKid.set(e.participant_id, arr);
  }

  if (detail.participants.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Add kids to the roster first, then record experiences.</p>;
  }
  if (detail.experiences.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">No experiences in the catalog yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <select className={field} value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
            {detail.participants.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
          <select className={field} value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
            {detail.experiences.map((x) => <option key={x.assessmentId} value={x.assessmentId}>{x.experienceName}</option>)}
          </select>
          <input className={field} inputMode="decimal"
            placeholder={selected ? `What he did (${selected.unit})` : "What he did"}
            value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {selected?.howTo ? (
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[color:var(--color-text-muted)]">{selected.howTo}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={record} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70">
            <Sparkles size={15} /> Record experience
          </button>
          {saved ? <span className="flex items-center gap-1 text-[13px] text-fern"><Check size={15} /> Recorded</span> : null}
          {err ? <span className="text-[13px] text-[color:var(--color-state-error)]">{err}</span> : null}
        </div>
        <p className="mt-3 text-[11.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
          Recorded quietly. He earns the experience and sees his own growth, never
          a test he can fail. The band is your read, not his.
        </p>
      </div>

      {detail.earned.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {detail.participants.filter((p) => (earnedByKid.get(p.id)?.length ?? 0) > 0).map((p) => (
            <li key={p.id} className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-[14px] font-semibold text-forest-deep">{fullName(p)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(earnedByKid.get(p.id) ?? []).map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3 py-1 text-[12.5px] text-forest-deep">
                    {e.band ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BAND_DOT[e.band] }} aria-hidden="true" /> : null}
                    {e.experienceName}
                    <span className="text-[color:var(--color-text-muted)]">
                      {e.value !== null ? `${e.value} ${unitFor.get(e.assessmentId) ?? ""}`.trim() : e.valueText}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ProgramDetail({ detail }: { detail: Detail }) {
  const [tab, setTab] = useState<Tab>("Families");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/boys" className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest">
          <ChevronLeft size={16} aria-hidden="true" /> Dads &amp; Kids
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">{detail.program.name}</h1>
          <span className="text-[13px] text-[color:var(--color-text-muted)]">
            <Users size={13} className="mr-1 inline text-forest" aria-hidden="true" />
            {detail.participants.length} on the roster
          </span>
        </div>
        {detail.program.location ? (
          <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">{detail.program.location}</p>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors ${
              tab === t ? "bg-forest text-bone" : "border border-[color:var(--border-strong)] bg-card text-[color:var(--color-text)] hover:border-forest"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Families" ? <FamiliesTab detail={detail} /> : null}
      {tab === "Roster" ? <RosterTab detail={detail} /> : null}
      {tab === "Schedule" ? <ScheduleTab detail={detail} /> : null}
      {tab === "Attendance" ? <AttendanceTab detail={detail} /> : null}
      {tab === "Badges" ? <BadgesTab detail={detail} /> : null}
      {tab === "Experiences" ? <ExperiencesTab detail={detail} /> : null}
    </div>
  );
}
