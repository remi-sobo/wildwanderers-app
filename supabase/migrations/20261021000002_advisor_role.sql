-- ============================================================
-- Wild Wanderers — the advisor role
--
-- A business advisor to the owner (Remi). Never staff, never a client.
-- On its own, this value grants nothing: no existing policy names it,
-- and an advisor profile carries no org_id, so every org-scoped policy
-- fails closed. What an advisor may reach is defined only by the
-- advisor_* tables and functions in the next migration.
--
-- Its own migration because a new enum value cannot be used in the
-- transaction that adds it.
-- ============================================================

alter type user_role add value if not exists 'advisor';
