#!/usr/bin/env bash
# Vraća podatke aplikacije (šema public) iz backupa sa Google Drive-a, na istom projektu.
# Pokreće ga GitHub Actions (.github/workflows/restore.yml), posle novog backupa trenutnog stanja.
#
#   SUPABASE_DB_URL=… RCLONE_DRIVE_TOKEN=… supabase/scripts/restore.sh 2026-11-03_0300
#
# U jednoj transakciji: briše sve redove iz tabela u public i učitava public-data.sql iz backupa.
# Šema (migracije) i nalozi (auth) se ne menjaju. Ako bilo šta pukne, baza ostaje kakva je bila.
# Triggeri su isključeni dok traje učitavanje (session_replication_role = replica), pa se ne prave
# lažni logovi i obaveštenja; na kraju se upisuje jedan log „backup vraćen“.
set -euo pipefail
STAMP=${1:?Navedi backup, npr. 2026-11-03_0300}
: "${SUPABASE_DB_URL:?Postavi SUPABASE_DB_URL}"
: "${RCLONE_DRIVE_TOKEN:?Postavi RCLONE_DRIVE_TOKEN}"
[[ $STAMP =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}(_[a-z-]+)?$ ]] || { echo "Neispravan naziv backupa: $STAMP" >&2; exit 1; }

export RCLONE_CONFIG_GDRIVE_TYPE=drive RCLONE_CONFIG_GDRIVE_SCOPE=drive.file RCLONE_CONFIG_GDRIVE_TOKEN="$RCLONE_DRIVE_TOKEN"
DIR=$(mktemp -d)
rclone copy "gdrive:Poznan backup/$STAMP/public-data.sql.gz" "$DIR"
[[ -s $DIR/public-data.sql.gz ]] || { echo "Backup $STAMP nije pronađen na Drive-u" >&2; exit 1; }
gunzip "$DIR/public-data.sql.gz"

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f - <<SQL
set session_replication_role = replica;
do \$\$
declare t text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into t from pg_tables where schemaname = 'public';
  execute 'truncate table ' || t || ' restart identity cascade';
end \$\$;
\i $DIR/public-data.sql
set session_replication_role = origin;
insert into public.audit_log (table_name, row_id, action, new)
values ('backup', '$STAMP', 'update', jsonb_build_object('vracen_backup', '$STAMP'));
SQL
echo "Vraćen backup $STAMP"
