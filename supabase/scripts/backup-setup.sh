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
OUT=$(rclone authorize drive "$(printf '{"scope":"drive.file"}' | base64)" 2>&1)
TOKEN=$(python3 -c '
import base64, json, re, sys
s = sys.stdin.read()
m = re.search(r"--->\s*(.+?)\s*<---", s, re.S)
if not m: sys.exit("Google prijava nije uspela")
v = m.group(1).strip()
if not v.startswith("{"):
    v = base64.b64decode(v + "=" * (-len(v) % 4)).decode()
d = json.loads(v)
t = d.get("token", d)
print(t if isinstance(t, str) else json.dumps(t))
' <<<"$OUT")
printf %s "$TOKEN" | gh secret set RCLONE_DRIVE_TOKEN --repo "$REPO"
# Isti pristup i na ovom Mac-u (remote „poznan-gdrive“), za pregled i preuzimanje backupa
rclone config create poznan-gdrive drive scope=drive.file token="$TOKEN" --non-interactive >/dev/null
echo "     Google Drive povezan."

echo
echo "2/2  Baza"
echo "     Supabase Dashboard → projekat poznan-app → dugme Connect → Session pooler → kopiraj URI."
echo "     Umesto [YOUR-PASSWORD] upiši lozinku baze (ako je ne znaš: Project Settings → Database → Reset database password)."
echo "     Nalepi ceo URI ovde (ne vidi se dok kucaš), pa Enter:"
gh secret set SUPABASE_DB_URL --repo "$REPO"

echo
echo "Gotovo. Prvi backup odmah:"
echo "  gh workflow run backup.yml --repo $REPO"
