# Access tests

`npm run test:rls` starts a throwaway local Postgres, loads a small stand-in
for the Supabase pieces the migrations use (`_supabase_stub.sql`), applies every
migration in order, and runs each `*.test.sql` file. Each test signs in as a
role by setting the database role to `authenticated` and the JWT claims the
way PostgREST does, so the policies and triggers under test are the real ones.

It needs Postgres server binaries (`initdb`, `pg_ctl`). Point `PG_BIN` at them
if they are not on `PATH`. Nothing here connects to a Supabase project.

Known local quirk: `20260704000002_ring7_boys_completions.sql` calls
`substr(x from n)`, which Postgres 16 rejects. The runner rewrites that one
call to `substring` for the local run only. The migration file is unchanged.

## profiles_guard

Covers `20261021000001_profiles_guard_privileged.sql`: nobody can set their
own `role` or `org_id`, the owner can change roles inside their own org, and
the server's admin paths (invite a coach, attach a client or parent login)
keep working.

Before applying that migration to production, check what the live database
already has. These are read-only:

```sql
-- Policies on profiles
select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'profiles';

-- Column-level UPDATE grants on profiles for the API roles
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('authenticated', 'anon') and privilege_type = 'UPDATE'
order by grantee, column_name;

-- Triggers on profiles
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;
```

If `authenticated` holds UPDATE on `role` or `org_id` and no trigger guards
them, the gap is live.
