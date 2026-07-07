import { PenSquare } from "lucide-react";
import { getClients, clientName } from "@/lib/data/clients";
import { getMessageableGuardians, getStaffDirectory } from "@/lib/data/messages";
import {
  openThreadWithClient,
  openThreadWithGuardian,
  startThreadWithStaff,
} from "@/lib/messaging/actions";

function PersonButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset"
      >
        {label}
      </button>
    </form>
  );
}

// Start a conversation with anyone on the other side of the line: staff pick
// any client or family; a client or family member picks a staff person (for
// Wild Wanderers today, that is Gabe). Never member to member.
export async function NewMessage({ isStaff }: { isStaff: boolean }) {
  if (isStaff) {
    const [clients, guardians] = await Promise.all([
      getClients(),
      getMessageableGuardians(),
    ]);
    const activeClients = clients.filter((c) => c.status !== "archived");
    if (activeClients.length === 0 && guardians.length === 0) return null;
    return (
      <details className="group rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[13.5px] font-semibold text-forest [&::-webkit-details-marker]:hidden">
          <PenSquare size={15} aria-hidden="true" />
          New message
        </summary>
        <div className="flex flex-col gap-3 border-t border-[color:var(--border-hair)] px-5 py-4">
          {activeClients.length > 0 ? (
            <div>
              <p className="eyebrow mb-2 text-bark">Clients</p>
              <div className="flex flex-wrap gap-2">
                {activeClients.map((c) => (
                  <PersonButton
                    key={c.id}
                    action={openThreadWithClient.bind(null, c.id)}
                    label={clientName(c)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {guardians.length > 0 ? (
            <div>
              <p className="eyebrow mb-2 text-bark">Families</p>
              <div className="flex flex-wrap gap-2">
                {guardians.map((g) => (
                  <PersonButton
                    key={g.id}
                    action={openThreadWithGuardian.bind(null, g.id)}
                    label={g.name}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    );
  }

  const staff = await getStaffDirectory();
  if (staff.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {staff.map((s) => (
        <form key={s.id} action={startThreadWithStaff.bind(null, s.id)}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep"
          >
            <PenSquare size={14} aria-hidden="true" />
            Message {s.first_name}
          </button>
        </form>
      ))}
    </div>
  );
}
