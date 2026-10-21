#!/usr/bin/env bash
# Runs the SQL access tests in supabase/tests against a throwaway local
# Postgres: a fresh cluster, the Supabase stub, every migration in order,
# then each *.test.sql file. Nothing here touches a real project.
#
#   npm run test:rls
#
# Needs Postgres server binaries (initdb, pg_ctl). Set PG_BIN to point at
# them if they are not on PATH, e.g. PG_BIN=/usr/lib/postgresql/16/bin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${PG_BIN:-}" ]]; then
  if command -v initdb >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v initdb)")"
  else
    PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  fi
fi
if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "Postgres server binaries not found. Set PG_BIN." >&2
  exit 2
fi

WORK="$(mktemp -d)"
DATA="$WORK/data"
PORT="${PG_TEST_PORT:-54329}"
RUN_AS=()
# initdb refuses to run as root; use the postgres OS user when we are root.
if [[ "$(id -u)" == "0" ]]; then
  chown -R postgres "$WORK" 2>/dev/null || true
  RUN_AS=(su postgres -s /bin/bash -c)
fi

run() {
  if [[ ${#RUN_AS[@]} -gt 0 ]]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi
}

cleanup() {
  run "'$PG_BIN/pg_ctl' -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run "'$PG_BIN/initdb' -D '$DATA' -U postgres --auth=trust" >/dev/null
run "'$PG_BIN/pg_ctl' -D '$DATA' -o '-p $PORT -k $WORK -c listen_addresses=' -l '$WORK/log' -w start" >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d ww_template)

# Migrations go into a template once; every test file gets a fresh copy,
# so fixtures in one file never collide with another.
psql -X -q -h "$WORK" -p "$PORT" -U postgres -d postgres -c "create database ww_template" >/dev/null

"${PSQL[@]}" -f "$ROOT/supabase/tests/_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  src="$f"
  # ring7 uses substr(x from n), which Postgres 16 rejects (substring
  # accepts it). Rewrite that one call for the local run only; the
  # migration file itself is never changed.
  if [[ "$(basename "$f")" == "20260704000002_ring7_boys_completions.sql" ]]; then
    src="$WORK/$(basename "$f")"
    sed 's/substr(p\.parent_name from/substring(p.parent_name from/' "$f" > "$src"
  fi
  if ! "${PSQL[@]}" -f "$src" >/dev/null 2>"$WORK/err"; then
    echo "Migration failed: $(basename "$f")" >&2
    cat "$WORK/err" >&2
    exit 1
  fi
done

status=0
i=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  name="$(basename "$t")"
  i=$((i + 1))
  psql -X -q -h "$WORK" -p "$PORT" -U postgres -d postgres -c "create database ww_test_$i template ww_template" >/dev/null
  if psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d "ww_test_$i" -f "$t" 2>"$WORK/err"; then
    echo "ok    $name"
  else
    echo "FAIL  $name" >&2
    cat "$WORK/err" >&2
    status=1
  fi
done
exit $status
