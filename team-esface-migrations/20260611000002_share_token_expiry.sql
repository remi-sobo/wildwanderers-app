-- ============================================================
-- LOCK THE DOORS (2/5) — season share tokens expire
-- ============================================================
-- Share tokens on season_summaries lived forever: a leaked link
-- exposed a minor's season data permanently. Tokens now expire 90
-- days after the summary is (re)generated, and the anon-callable
-- lookup RPC refuses expired tokens. Regenerating a summary
-- refreshes the window (handled in the app's upsert).

alter table season_summaries
  add column if not exists share_token_expires_at timestamptz
    not null
    default (now() + interval '90 days');

-- Existing rows get now() + 90 days from the column default at ADD
-- time, which is the right call: every previously minted link keeps
-- working for one more season's length, then dies.

create or replace function public.get_season_summary_by_token(token text)
returns season_summaries
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select * from public.season_summaries
  where share_token = token
    and share_token_expires_at > now()
  limit 1;
$$;

revoke execute on function public.get_season_summary_by_token(text) from public;
grant  execute on function public.get_season_summary_by_token(text) to anon, authenticated;
