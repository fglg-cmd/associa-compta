#!/usr/bin/env bash
# Exécute les migrations puis les tests SQL sur une base PostgreSQL jetable.
# Usage : DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/db-test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
DB="associa_test_$$"
psql "$ADMIN_URL" -q -c "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -q -c "drop database if exists $DB" >/dev/null' EXIT
URL="${ADMIN_URL%/*}/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "✗ migration $(basename "$f")"; exit 1; }
  echo "✓ migration $(basename "$f")"
done
for t in "$ROOT"/supabase/tests/[0-9]*.sql; do
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$t" || { echo "✗ test $(basename "$t")"; exit 1; }
  echo "✓ test $(basename "$t")"
done
