import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Append a privileged body/food access to the sealed audit_events ledger.
// Fire-and-forget: never blocks or fails a user action. The ledger is
// service-role-only (RLS on, zero policies), so this goes through the admin
// chokepoint. metadata holds field NAMES and primitive labels only, NEVER
// values or user content (see the migration and CLAUDE.md).
export async function auditLog(event: {
  actorId: string | null;
  orgId: string | null;
  action: string;
  entityTable: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // No service key configured (e.g. before it is set in Vercel): skip
    // quietly rather than throw. Auditing is best-effort, never a blocker.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      actor_id: event.actorId,
      org_id: event.orgId,
      action: event.action,
      entity_table: event.entityTable,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ?? {},
    });
  } catch {
    // Swallow: an audit write must never surface to the client.
  }
}
