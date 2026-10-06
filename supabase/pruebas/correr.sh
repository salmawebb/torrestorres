#!/usr/bin/env bash
# Crea un Postgres temporal, aplica las migraciones y corre las pruebas.
# Uso: supabase/pruebas/correr.sh   (necesita PostgreSQL 15+ instalado)
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
dir="$(mktemp -d)"
trap '"$bin/pg_ctl" -D "$dir/datos" stop -m fast >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT
"$bin/initdb" -D "$dir/datos" -U postgres -A trust >/dev/null
"$bin/pg_ctl" -D "$dir/datos" -o "-k $dir -c listen_addresses=''" -l "$dir/log" start >/dev/null
psql=(psql -h "$dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${psql[@]}" -f "$aqui/supabase_simulado.sql"
for m in "$aqui"/../migrations/*.sql; do
  echo "Migración: $(basename "$m")"
  "${psql[@]}" -f "$m"
done
"${psql[@]}" -o /dev/null -f "$aqui/pruebas.sql"
