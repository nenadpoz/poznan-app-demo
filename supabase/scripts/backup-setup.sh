#!/usr/bin/env bash
# Jednokratno podešavanje backupa: povezuje Google Drive i bazu sa GitHub Actions (tajne u repou).
# Pokreće vlasnik na svom Mac-u; lozinka i token idu direktno u GitHub tajne i nigde se ne ispisuju.
#
#   supabase/scripts/backup-setup.sh
set -euo pipefail
REPO=nenadpoz/poznan-app-demo
command -v rclone >/dev/null || brew install rclone
command -v gh >/dev/null || { echo "Treba GitHub CLI: brew install gh, pa gh auth login" >&2; exit 1; }

echo
echo "1/2  Google Drive"
echo "     Otvoriće se pregledač. Prijavi se Google nalogom na kom želiš backupe i dozvoli pristup."
echo "     rclone dobija pristup samo fajlovima koje sam napravi (folder „Poznan backup“), ne celom Drive-u."
# Remote „poznan-gdrive“ na ovom Mac-u (za pregled i preuzimanje backupa); isti token ide u GitHub
rclone config delete poznan-gdrive 2>/dev/null || true
rclone config create poznan-gdrive drive scope=drive.file config_change_team_drive=false >/dev/null
TOKEN=$(rclone config show poznan-gdrive | sed -n 's/^token = //p')
[[ $TOKEN == *access_token* ]] || { echo "Google prijava nije uspela, pokreni skriptu ponovo." >&2; exit 1; }
printf %s "$TOKEN" | gh secret set RCLONE_DRIVE_TOKEN --repo "$REPO"
rclone mkdir "poznan-gdrive:Poznan backup"
echo "     Google Drive povezan (folder „Poznan backup“)."

echo
echo "2/2  Baza"
echo "     Supabase Dashboard → projekat poznan-app → dugme Connect → Session pooler → kopiraj URI."
echo "     Umesto [YOUR-PASSWORD] upiši lozinku baze (ako je ne znaš: Project Settings → Database → Reset database password)."
echo "     Nalepi ceo URI ovde (ne vidi se dok kucaš), pa Enter:"
gh secret set SUPABASE_DB_URL --repo "$REPO"

echo
echo "Gotovo. Prvi backup odmah:"
echo "  gh workflow run backup.yml --repo $REPO"
