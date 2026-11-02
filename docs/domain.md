# Kako aplikacija radi (domen)

Ovo je dogovoreni opis aplikacije, izveden iz demoa (`demo/index.html`). Kad se demo i ovaj dokument razlikuju, važi ovaj dokument.

Opšta pravila:
- UI na srpskom, latinica. Iznosi `1.234.567 RSD`, datumi `21. okt 2026.`, vreme `08:00`.
- Dva korisnika (Nenad i Jovan), oba admini sa istim pravima.
- Svaka izmena podataka ide u logove (ko, šta, kada, staro i novo).
- Svako brisanje traži potvrdu u prozoru.
- Dugme za čuvanje u formi za izmenu je isključeno dok se nešto ne promeni.
- Glasovna komanda nikad ne čuva direktno, uvek otvara popunjenu formu.
- Tema: svetla, tamna, sistemska; boje samo preko tokena.

## 1. Korisnici i nalozi
- Prva prijava: korisnik postavlja lozinku (dva polja, najmanje 8 karaktera).
- Zaboravljena lozinka: link za reset na email. Svaki admin može da resetuje lozinku drugom; drugi tada postavlja novu pri sledećoj prijavi.
- Promena lozinke traži trenutnu lozinku. Postavljanje, promena i reset idu u logove (bez same lozinke).
- Lično po nalogu: tema, boje traka limita, podešavanja obaveštenja, email za obaveštenja.

## 2. Navigacija
- Donji meni: **Pregled, Promet, Poslovi, Zadaci, Klijenti**.
- Kad je stavka menija aktivna, umesto njene ikonice stoji „+“ sa natpisom radnje: **Dodaj promet**, **Dodaj posao** (Poslovi → Lista) ili **Zakaži termin** (Poslovi → Kalendar), **Dodaj zadatak**, **Dodaj klijenta**.
- Gore desno na svakom ekranu: **zvonce** sa crvenim brojem nepročitanih obaveštenja (broj se ne prikazuje kad je 0) i avatar koji otvara Podešavanja.

## 3. Pregled (početna)
Tri kartice, tim redom:
1. **Trake limita**: po jedna traka za svaku firmu koja nije zatvorena. Levo naplaćeno u tekućoj godini, desno preostalo do limita, naziv firme unutar trake (centriran, menja boju preko granice popune). Maksimum je paušal limit iz podešavanja (podrazumevano 6.000.000 RSD), ne ispisuje se. Boja: zelena, žuta od 80%, crvena od 95%; preko limita preostalo je negativno i crveno. Svaki korisnik može svakoj firmi da izabere stalnu boju trake (Podešavanja → Boje traka limita); preostali iznos i dalje menja boju po limitu.
2. **Zarada**: izbor perioda (tabovi **Godina, Mesec, Period**; podrazumevano tekuća godina; Mesec ima mesec + godinu sa strelicama; Period ima od–do, datumi se okreću ako je „od“ posle „do“). Pločice **Ukupno, Preko firme, Keš** sa iznosima. Veliki iznos prikazuje izabranu pločicu. Samo na pločici Ukupno ispod iznosa stoje troškovi i profit.
3. **Grafik poslednjih 6 meseci**: prihodi, troškovi i profit; prati izbor pločice, ne prati period.

## 4. Firme
### Podaci
| Polje | Napomena |
|---|---|
| naziv, adresa, PIB, matični broj, delatnost, datum osnivanja | adresa ide na fakture |
| oblik | `pausal`, `pdv` (preduzetnik u PDV-u), `van_pdv`, `doo` |
| faza | `neaktivna` (podrazumevana za novu firmu), `aktivna`, `mirovanje`, `zatvorena` |
| mesečna obaveza | za paušal: porez + doprinosi |
| ikonica ili logo | ikonica iz skupa (zgrada, bušilica, kamion, alat, aktovka, kuća) ili ubačen logo; logo ima prednost |
| napomena | |

### Lista firmi (Podešavanja → Firme)
- Tabovi **Sve · Otvorene · Zatvorene** sa brojem. Otvorene su sve koje nisu zatvorene.
- Kartica firme: ikonica/logo, naziv, oblik i šifra delatnosti, faza, prihod u godini i traka paušal limita.

### Stranica firme
- **Faza**: dugmad Neaktivna · Aktivna · U mirovanju · Zatvorena. Svaka promena faze otvara prozor sa **datumom promene** (podrazumevano danas) i opcionim **komentarom**.
- Ispod faze jedan red: trenutna faza i od kada važi (npr. „Aktivna od 1. nov 2026.“) i link **Istorija (N)**.
- **Istorija izmena** (prozor): promene faze (sa datumom), promene oblika poslovanja (sa datumom i prethodnim oblikom) i sve ostale izmene podataka firme („Izmena podataka“: polje, staro → novo, ko i kada). Izmena logoa i ikonice se ne beleži u istoriji.
- Prihod u godini, troškovi, profit.
- Za paušal: traka godišnjeg limita, mesečna obaveza, napomena o SEF-u. Za PDV obveznika: PDV za period, rok prijave, prethodni mesec.
- Grafik poslednjih 6 meseci za firmu.
- Tabovi **Sve · Prihodi · Troškovi** sa poslednjim unosima firme.
- **Komentari** firme (vidi 10).
- Osnovni podaci (PIB, MB, delatnost, osnovana, napomena).
- Na dnu crveno dugme **Obriši firmu**. Firma bez prometa se briše posle potvrde; firma sa prometom ne može da se obriše, prozor nudi prebacivanje u fazu Zatvorena.

### Izmena firme
- Dugmad **Sačuvaj izmene** i **Otkaži** (nova firma: **Sačuvaj firmu**). Brisanje nije u formi.
- Kad se promeni faza ili oblik, pojavi se polje **Datum promene**.
- Komentar uz promenu faze ide u istoriju i u komentare firme (drugi korisnik dobija obaveštenje).

### Pravila za paušal i PDV
- Paušal: godišnji limit prihoda 6.000.000 RSD po kalendarskoj godini (podešavanje).
- PDV prag: 8.000.000 RSD u poslednjih 12 meseci (podešavanje).
- Upozorenja: žuto 80%, crveno 95% (podešavanje).
- Preduzetnik u PDV-u: iznosi bez PDV-a uz stopu 20/10/0%; izlazni minus ulazni PDV; rok 15. u mesecu za prethodni mesec.
- Iznose i rokove proveriti sa knjigovođom na početku svake godine.

## 5. Promet (transakcije)
- Polja: tip (`prihod` | `trosak`), iznos (RSD, bez PDV-a), datum, firma (opciono), klijent (opciono), kategorija, PDV stopa (samo PDV firma), opis, veza na posao (opciono), broj fakture (opciono).
- Firma se bira **karticama** (kao radio dugme): prva je **Bez firme (keš)** sa ikonicom novca i podrazumevana je; ostale su otvorene firme sa ikonicom ili logom.
- Način naplate se ne bira: bez firme = keš bez računa, sa firmom = preko računa.
- Lista Prometa grupisana po mesecima, filter po tipu (Sve/Prihodi/Troškovi) i po firmi (ili keš).

## 6. Klijenti
- Klijent je kontakt: **vrsta** (fizičko ili pravno lice), ime ili naziv firme, PIB i MB (za pravno lice, nisu obavezni), mesto, adresa, mobilni, email, napomena. Nezavisan od firmi.
- Stranica Klijenti: tabovi **Fizička lica: N** i **Pravna lica: N**, pretraga po imenu/mestu/telefonu, red sa mestom, telefonom, ukupno naplaćenim i dugmetom za poziv. „+“ dodaje klijenta izabrane vrste.
- Kartica klijenta:
  - kontakt sa dugmićima: telefon (**poziv** + kopiraj), adresa (**Google mape** + kopiraj), email (**novi mejl** + kopiraj), PIB/MB za pravno lice (kopiraj PIB);
  - ukupno naplaćeno, od toga keš, naplata po firmi;
  - **Termini u kalendaru** sa filterima po statusu (**Svi, Na čekanju, U procesu, Završeno**, sa brojem) i dugmetom **Zakaži termin** (forma bez izbora klijenta, klijent je već poznat);
  - **Obriši klijenta** (briše i njegove poslove; transakcije, termini i zadaci ostaju bez veze).

## 7. Poslovi
### Podaci
- Posao pripada jednom klijentu (jedan klijent može imati više poslova).
- Polja: kategorija, datum i opciono vreme početka, **ko radi** (Nenad, Jovan, Obojica; podrazumevano Obojica), status, datum završetka, opis, slike, opciona **adresa posla** (ako nije upisana, koristi se adresa klijenta), komentari, podsetnici, očekivane stavke naplate, veza na prihode.
- Statusi: **Na čekanju → U procesu → Čeka uplatu → Završeno**. Novi posao je Na čekanju. Završeno ide u arhivu i dobija datum završetka.

### Forma „Novi posao“
- Počinje izborom klijenta: vrsta (Fizičko/Pravno lice), pa polje imena sa **pretragom od prvog slova** (samo klijenti izabrane vrste), poslednja stavka **„+ Dodaj novog“**.
- Izbor postojećeg klijenta popunjava i **zaključava** njegova polja („Drugi klijent“ poništava izbor). Novo ime pri čuvanju pravi i novog klijenta.
- „Posao je na drugoj adresi“ otvara polja ulica i mesto.

### Lista i kartica
- Poslovi imaju tabove **Lista** i **Kalendar**.
- Lista: samo aktivni poslovi, prvo oni koji počinju danas ili kasnije (najbliži prvi), zatim započeti (najskoriji prvi); između redova razlika u danima. Red: klijent, kategorija, adresa posla, početak, status, ko radi, dugmad navigacija i poziv. Pretraga i filter kategorije. Ikonica arhive otvara završene poslove.
- Kartica posla: status, klijent (link), telefon, adresa posla sa navigacijom (i adresa klijenta ako se razlikuje), ko radi, početak/završetak, naplata, opis, komentari, slike, termini klijenta, **Obriši posao**.

### Početak posla
- Kad dođe datum (i vreme, ako je upisano) početka, a posao je Na čekanju, aplikacija pita: „Da li da prebacim [klijent] · [kategorija] u U procesu?“ (Prebaci / Ne sada). Pita se jednom po korisniku za isti početak; posle promene početka pita se ponovo. U mobilnoj aplikaciji ovo stiže i kao push.

### Naplata (završavanje posla)
- Klik na **Završeno** ili **Čeka uplatu** otvara prozor **Naplata posla**:
  - višestruki izbor kartica **Keš, Poznan Drill, Poznan Trans…** (otvorene firme), za svaku iznos i opis, ukupno;
  - polje **Komentar** (ide u komentare posla, drugi korisnik dobija obaveštenje);
  - dugmad **Naplaćeno, završi posao** · **Čeka se uplata** · **Završi bez naplate** · **Otkaži**.
- **Naplaćeno**: svaka stavka postaje prihod (danas, klijent posla, firma ili keš, veza na posao); posao se završava. Faktura se tada ne nudi.
- **Čeka se uplata**: stavke se pamte na poslu kao očekivane i **ne ulaze u Promet**; status je Čeka uplatu. Za stavke preko firme odmah se nudi **Faktura**.
- Kartica posla u statusu Čeka uplatu: iznosi po stavkama, dugmad za fakture, **Uplaćeno, posao završen** (potvrda „Da li je stigla uplata od … RSD?“ → stavke postaju prihodi, broj fakture ostaje) i **Izmeni iznose** (isti prozor, popunjen).
- Kartica posla posle naplate: „Naplaćeno“ ukupno i po stavkama, i broj izdate fakture kao tekst.

### Faktura
- Pravi se **samo dok posao čeka uplatu**, za svaku stavku preko firme (klijent fizičko ili pravno lice); za keš nikad.
- Sadržaj: izdavalac (naziv, adresa, PIB, MB, delatnost), kupac (naziv, adresa, PIB i MB; za fizičko lice „Fizičko lice“), broj po firmi i godini (npr. `DR-2026-001`), datum prometa i izdavanja, mesto, stavka, ukupno, za paušal napomena da obveznik nije u sistemu PDV-a.
- Broj se dodeljuje pri prvom preuzimanju i ne menja se. Otvara se za štampu ili čuvanje kao PDF. U pravoj aplikaciji: PDF iz Edge Function-a, kasnije slanje na SEF.

### Podsetnik za uplatu
- Posao u statusu Čeka uplatu može imati podsetnike: datum, vreme, kome (**Samo meni** ili **Oba korisnika**), napomena.
- Kad dođe vreme, stiže obaveštenje „Podsetnik: čeka se uplata“ (klik otvara posao); u pravoj aplikaciji i push/email po ličnim podešavanjima. Posle uplate podsetnici više ne stižu.

## 8. Termini (kalendar)
- Termin je jedan dolazak: datum, vreme od–do, kratak opis, kategorija, ko radi, klijent (opciono), firma (opciono, „Bez firme - keš“), napomena, završen.
- Prikazi mesec, nedelja, dan, filter po osobi.
- Status termina: završen = Završeno; budući = Na čekanju; današnji i raniji = U procesu.
- Iz termina se može otvoriti unos prihoda (naplata) sa popunjenim podacima.

## 9. Zadaci
- Polja: naziv, ko je zadužen (Nenad, Jovan, Obojica), status (Na čekanju, U procesu, Završeno; kod završenog ko i kada), rok (opciono), **vezan za posao** (opciono, polje sa pretragom termina; podrazumevano ništa), napomena, komentari. Zadatak nema svog klijenta; vidi se preko posla.
- Lista grupisana: kasni, danas, narednih 7 dana, kasnije, bez roka. Filteri u dva reda: **Osobe** (Svi, Nenad, Jovan, Zajednički) i **Statusi** (Svi, Na čekanju, U procesu, Završeno), sa brojevima.
- Kvačica na listi otvara potvrdu **„Završi zadatak?“**; vraćanje završenog ide bez pitanja.
- Forma: dugmad **Obriši** (crveno, kanta) · **Sačuvaj zadatak** (zeleno) · **Zatvori**; čuvanje isključeno dok nema promene.
- Na listi pored zadatka broj komentara.

## 10. Komentari
- Postoje na **zadacima, poslovima i firmama**.
- Komentar: ko, kada, tekst. Na svaki komentar može da se **odgovori** (jedan nivo, uvučeno). Čuvaju se odmah. Svako briše samo svoje; brisanje komentara briše i odgovore. Sve ide u logove.
- Svaki komentar i odgovor šalje obaveštenje drugom korisniku.

## 11. Obaveštenja
- **Zvonce** (u aplikaciji): lista samo nepročitanih, „Označi sve kao pročitano“, „Nema novih obaveštenja.“ kad je prazno. Vrste: komentar, odgovor, podsetnik za uplatu (kasnije i početak posla, rok zadatka, limit firme). Klik otvara zadatak/posao/firmu i skroluje do komentara (kratko istakne). Otvaranje zadatka ili posla označava njegova obaveštenja kao pročitana.
- **Push i email** (Podešavanja → Obaveštenja, lično po nalogu): uključeno/isključeno po kanalu, email adresa za profil, vreme slanja od–do po kanalu (podrazumevano push 07:00–21:00, email 08:00–20:00; van tog vremena čeka početak), vrste: Početak posla, Zadaci (novi dodeljen meni, rok danas), Limit firme (80% i 95%). Izmene idu u logove.

## 12. Podešavanja
- Firme, Logovi, Kategorije poslova, Boje traka limita (lično), Obaveštenja (lično), Odjava.
- U pravoj aplikaciji i: tema, lozinka, limiti i upozorenja, backup.
- **Kategorije poslova**: zajednička lista za poslove i termine; naziv (jedinstven) i boja od šest. Brisanje kategorije ne briše poslove, samo im uklanja kategoriju.

## 13. Logovi (audit)
- Zapis: vreme, korisnik, entitet (`posao`, `termin`, `zadatak`, `klijent`, `firma`, `transakcija`, `podesavanja`, `backup`, `nalog`), akcija, naziv, lista promena (polje, staro, novo).
- Prikaz po danima, filteri po entitetu, korisniku, periodu i tekstu.

## 14. Backup
- Na Google Drive svakih N dana (podrazumevano 3), čuva se poslednjih 10. Sadrži export svih tabela i slike.

## 15. Stanje novca i valuta (planirano, još nije u demou ni u kodu)
Zahtev vlasnika od 2. nov 2026. Uvodi se pre ekrana Promet u mobilnoj aplikaciji.

**Računi (izvori novca)**
- Svaka firma ima svoj račun, plus jedna zajednička **zaliha keša**.
- Stanje svakog računa i keša se vidi u svakom trenutku.
- **Naslovna strana** ima brojač stanja: koliko je na računu svake firme i koliko u kešu. Osvežava se posle svake promene.

**Svaka promena novca bira izvor**
- **Naplata (prihod):** bira se gde novac ulazi, na račun jedne od firmi ili u keš. Isto važi i za naplatu posla (stavka Keš puni zalihu keša, stavka firme puni račun te firme).
- **Trošak / plaćanje:** bira se odakle novac izlazi, sa računa firme ili iz keša.
- **Podizanje novca:** prebacivanje sa računa firme u keš (i obrnuto, polaganje keša na račun). To nije prihod ni trošak, samo prenos između računa, i ne ulazi u paušal limit ni u profit.
- Uz svaku promenu piše **ko je izvršio** transakciju (Nenad ili Jovan) i kada.
- Početno stanje računa i keša se unosi jednom (ili kasnije kao korekcija, koja ide u logove).

**Valuta EUR / RSD**
- Prikaz je podrazumevano u **evrima**. Jednim klikom (prekidač u zaglavlju) se ceo prikaz prebacuje EUR ↔ RSD. Izbor se pamti po nalogu.
- Kurs je **srednji kurs NBS za taj dan** (preuzima se automatski jednom dnevno; ako za danas još nema kursa, koristi se poslednji objavljeni).
- Pri unosu prihoda ili troška bira se valuta iznosa (dinari ili evri). Čuva se originalni iznos i valuta, plus kurs tog dana, da se stari iznosi ne menjaju kad se kurs promeni.
- **Paušal limit i PDV prag se uvek računaju u dinarima** (zakonski su u RSD), bez obzira na izabrani prikaz. Format: `1.234.567 RSD` i `1.234,56 EUR` (ili `€ 1.234,56`, odlučiti u dizajnu).

**Uticaj na model (za implementaciju)**
- Nova tabela `accounts` (firma ili keš) i `transfers` (podizanje/polaganje).
- `transactions`: `account_id` (izvor/odredište), `currency` (`RSD`/`EUR`), `amount_original`, `fx_rate`, iznos u RSD za limite; `created_by` se prikazuje uz stavku.
- `fx_rates` (datum, EUR srednji kurs), puni ga Edge Function iz pg_cron-a.
- `profiles.currency` za izabrani prikaz.
- Stanje računa = početno stanje + prihodi − troškovi ± prenosi (view u bazi).
