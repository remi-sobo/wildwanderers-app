-- ============================================================
-- Security baseline 2026-11: the pop-up waiver RPCs go server-only.
--
-- popup_waiver_for_token and sign_popup_waiver were executable by anon and
-- authenticated, so anyone holding the public anon key could call
-- sign_popup_waiver straight through PostgREST. That skipped the honeypot
-- and the per-IP limit in src/lib/popup/sign-action.ts, and let the caller
-- write any value into signed_ip and user_agent on a waiver that can carry
-- a minor's age, guardian and emergency contact.
--
-- After this migration only service_role may execute them. The page and the
-- server action call them through the admin client (same branch), so the
-- IP and user agent always come from the server's own request headers.
--
-- ORDER: deploy the app code on this branch first, then apply this file.
-- Applied the other way round, guests cannot open or sign the waiver until
-- the code ships. Do not apply without Remi's yes.
--
-- Idempotent: revoke/grant can run any number of times.
-- ============================================================

revoke execute on function public.popup_waiver_for_token(text)
  from public, anon, authenticated;
grant execute on function public.popup_waiver_for_token(text) to service_role;

revoke execute on function public.sign_popup_waiver(
  text, text, text, text, integer, text, text, boolean, text, text, text, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.sign_popup_waiver(
  text, text, text, text, integer, text, text, boolean, text, text, text, boolean, text, text
) to service_role;
