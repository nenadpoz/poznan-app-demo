#!/usr/bin/env bash
# Backup baze na Google Drive (folder „Poznan backup“). Pokreće ga GitHub Actions svake noći (.github/workflows/backup.yml).
#
#   SUPABASE_DB_URL=… RCLONE_DRIVE_TOKEN=… supabase/scripts/backup.sh [oznaka]
#
# Jedan backup je folder „GGGG-MM-DD_HHMM[_oznaka]“ sa četiri fajla (gzip):
#   roles.sql, schema.sql, data.sql  kompletna baza (za novi projekat, vidi supabase/README.md)
#   public-data.sql                   samo podaci aplikacije (za vraćanje na istom projektu, restore.sh)
# Backupi stariji od KEEP_DAYS (podrazumevano 30) se brišu, ali tek posle uspešnog novog.
set -euo pipefail
: "${SUPABASE_DB_URL:?Postavi SUPABASE_DB_URL (Session pooler URI)}"
: "${RCLONE_DRIVE_TOKEN:?Postavi RCLONE_DRIVE_TOKEN}"
KEEP_DAYS=${KEEP_DAYS:-30}
SB=${SUPABASE_BIN:-supabase}

STAMP=$(TZ=Europe/Belgrade date +%Y-%m-%d_%H%M)${1:+_$1}
DIR=$(mktemp -d)/$STAMP
mkdir -p "$DIR"

dump() { $SB db dump --remote="$SUPABASE_DB_URL" "$@"; }
dump --role-only -f "$DIR/roles.sql"
dump -f "$DIR/schema.sql"
dump --data-only --use-copy -f "$DIR/data.sql"
dump --data-only --use-copy --schema public -f "$DIR/public-data.sql"

# Provera da dump nije prazan
grep -Eq '^COPY "?public"?\."?transactions"?' "$DIR/public-data.sql" || { echo "public-data.sql nema tabelu transactions" >&2; exit 1; }
gzip -9 "$DIR"/*.sql
SIZE=$(cat "$DIR"/*.gz | wc -c | tr -d ' ')

# Google Drive preko rclone-a, bez config fajla (scope drive.file: rclone vidi samo fajlove koje je sam napravio)
export RCLONE_CONFIG_GDRIVE_TYPE=drive RCLONE_CONFIG_GDRIVE_SCOPE=drive.file RCLONE_CONFIG_GDRIVE_TOKEN="$RCLONE_DRIVE_TOKEN"
rclone copy "$DIR" "gdrive:Poznan backup/$STAMP"
rclone lsl "gdrive:Poznan backup/$STAMP"
rclone delete "gdrive:Poznan backup" --min-age "${KEEP_DAYS}d"
rclone rmdirs "gdrive:Poznan backup" --leave-root

# Zapis u tabelu backups (ide i u logove preko audit triggera)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c \
  "insert into public.backups (size, storage_path) values ($SIZE, 'Google Drive/Poznan backup/$STAMP')"
echo "Backup $STAMP: $SIZE bajtova"
