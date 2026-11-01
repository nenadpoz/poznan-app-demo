# Domen

## Korisnici
- Dva naloga, Nenad i Jovan, oba admin, ista prava.
- Lozinka se postavlja pri prvoj prijavi: dva polja, nova i ponovljena, najmanje 8 karaktera.
- Zaboravljena lozinka: link za reset na email. Svaki admin može da resetuje lozinku drugom adminu, koji onda postavlja novu pri sledećoj prijavi.
- Promena lozinke traži trenutnu lozinku. Postavljanje, promena i reset lozinke idu u logove, bez same lozinke.
- Svaki korisnik ima svoje podešavanje teme (svetla / tamna / sistemska) i svoje boje traka limita po firmi.
- Obaveštenja (Podešavanja → Obaveštenja), posebno za svaki nalog: push na telefon (uključeno/isključeno), email (uključeno/isključeno, sa adresom koju korisnik upiše za svoj profil) i koja obaveštenja stižu: Početak posla, Zadaci (novi dodeljen meni, rok danas), Limit firme (80% i 95%). Ista obaveštenja idu na oba kanala. Svaki kanal ima svoje vreme slanja „od–do“ (podrazumevano push 07:00–21:00, email 08:00–20:00). Obaveštenje koje nastane van tog vremena stiže kad vreme počne. Izmene idu u logove.
- Svaka prijava i izmena se beleži u logove.

## Firma
| Polje | Napomena |
|---|---|
| naziv, adresa, PIB, matični broj, delatnost, datum osnivanja | adresa ide na fakture |
| oblik | `pausal`, `pdv` (preduzetnik u PDV-u), `van_pdv` (preduzetnik van PDV-a), `doo` |
| faza | `neaktivna` (prva, podrazumevana za novu firmu), `aktivna`, `mirovanje`, `zatvorena` |
| mesečna obaveza | za paušal: porez + doprinosi iz rešenja |
| ikonica / logo | ikonica iz ponuđenog skupa (zgrada, bušilica, kamion, alat, aktovka, kuća) ili ubačen logo. Logo ima prednost. Menja se u Podešavanja → Firme → izmena firme. |

Firma sa prometom se ne briše. Prebacuje se u fazu `zatvorena`.

Svaka promena faze traži tačan datum kad se desila (podrazumevano danas) i opcioni komentar (npr. broj rešenja APR-a), i na kartici firme i u izmeni firme. Komentar ide u istoriju faza i u komentare firme, pa drugi korisnik dobija obaveštenje i može da odgovori.

Ispod izbora faze stoji samo trenutna faza i od kada važi; „Istorija (N)“ otvara celu istoriju promena u posebnom prozoru. U istoriju ulazi i promena oblika poslovanja (npr. Paušal → Preduzetnik van PDV-a), sa datumom promene iz izmene firme i prethodnim oblikom, kao i svaka druga izmena podataka firme („Izmena podataka“: koje polje, staro → novo, ko i kada), osim izmene logoa i ikonice.

Firma ima komentare isto kao posao i zadatak (ko, kada, tekst, odgovori, obaveštenje drugom korisniku; klik na obaveštenje otvara firmu). Firma čuva istoriju faza (faza, od kog datuma, ko je promenio, napomena), koja se prikazuje ispod izbora faze. Promena ide u logove sa datumom.

### Paušal
- Godišnji limit prihoda: **6.000.000 RSD po kalendarskoj godini** (konfigurabilno).
- PDV prag: **8.000.000 RSD u poslednjih 12 meseci** (konfigurabilno). Važi i za preduzetnike van PDV-a i DOO van PDV-a.
- Upozorenja: žuto na 80%, crveno na 95% (konfigurabilno).
- Projekcija: prosečan mesečni prihod u tekućoj godini puta 12, uz procenu meseca kada se dostiže limit.

### Preduzetnik u PDV-u
- Iznosi se unose bez PDV-a, uz stopu 20%, 10% ili 0%.
- Izlazni PDV iz prihoda, ulazni PDV iz troškova, razlika je obaveza ili povraćaj.
- Rok za PDV prijavu i uplatu: 15. u mesecu za prethodni mesec (mesečni period).
- Podsetnik: fakture se izdaju i primaju preko SEF-a.

> Iznose limita i rokove treba proveriti sa knjigovođom na početku svake godine.

### Početna strana (Pregled)
- Početna ima tri kartice: trake limita po firmama, zarada sa izborom načina naplate i grafik za poslednjih 6 meseci. Zadaci, upozorenja, pregled po firmama i poslednje izmene nisu na početnoj.

#### Zarada: preko firme i keš
- Zarada je zbir prihoda. Na pločici Ukupno ispod velikog iznosa stoje troškovi i profit za izabrani period. Na pločicama Preko firme i Keš prikazuje se samo zarada, bez troškova i profita.
- Način naplate sledi iz firme na unosu: unos sa firmom je „Preko firme (račun)“, unos bez firme je „Keš bez računa“. Ukupno je zbir ova dva.
- Tri pločice (Ukupno, Preko firme, Keš) uvek pokazuju sva tri iznosa za izabrani period.
- Period se bira na tri načina, tim redom: Godina (cela godina), Mesec (padajuće liste meseca i godine sa strelicama) i Period (od datuma do datuma). Podrazumevano je tekuća godina. Ako je „od“ posle „do“, datumi se okreću, a prazan datum znači bez ograničenja sa te strane.
- Izbor perioda ne utiče na trake limita i grafik za poslednjih 6 meseci. Grafik prati samo izbor načina naplate. Klik na pločicu bira šta se prikazuje u velikom iznosu i na grafiku.

#### Trake limita
- Na vrhu početne je kompaktna kartica sa po jednom trakom za svaku firmu koja nije zatvorena. Svaka traka ima isti maksimum od 6.000.000 RSD (podešavanje paušal limita), koji se ne ispisuje.
- Red ima tri dela: levo koliko je naplaćeno u tekućoj godini, u sredini naziv firme, desno koliko je preostalo do limita.
- Traka je puna koliko je limita potrošeno. Boja se menja na 80% (žuta) i 95% (crvena). Ako je limit prekoračen, preostali iznos je negativan i crven.
- Svaki korisnik u Podešavanjima („Boje traka limita“) može svakoj firmi da izabere stalnu boju trake iz palete kategorija ili da ostavi automatsku boju po limitu. Izbor važi samo za njegov nalog. Iznos preostalog i dalje postaje žut ili crven po limitu. Izmena ide u logove.

## Navigacija
- Donji meni: Pregled, Promet, Poslovi, Zadaci, Klijenti.
- Poslovi imaju dva taba pri vrhu: Lista (poslovi po datumu početka, sa arhivom) i Kalendar (termini po mesecu, nedelji i danu). Dugme „+“ u meniju na tabu Lista dodaje posao, a na tabu Kalendar zakazuje termin.
- Klijenti imaju dva taba pri vrhu: Fizička lica i Pravna lica (uz broj klijenata u svakom). „+“ u meniju dodaje klijenta izabrane vrste.
- Klijenti su imenik svih klijenata po abecedi, sa pretragom, ukupno naplaćenim i dugmetom za poziv. Klik otvara karticu klijenta.

## Klijent
- Klijent je kontakt: vrsta (fizičko ili pravno lice), ime ili naziv firme, PIB i matični broj (za pravno lice, nisu obavezni), mesto, adresa, mobilni, email, napomena.
- Jedan klijent može da ima više poslova. Kartica klijenta pokazuje kontakt, ukupnu naplatu i njegove termine u kalendaru, sa dugmetom „Zakaži termin“. Poslovi klijenta se vide na stranici Poslovi.
- Nezavisan od firmi.
- Brisanje klijenta briše i njegove poslove. Transakcije, termini i zadaci ostaju, ali bez veze sa klijentom.

## Posao
- Posao pripada jednom klijentu. Polja: ko radi (Nenad, Jovan ili Obojica, podrazumevano Obojica), kategorija, datum i vreme početka, status, datum završetka, opis, više slika. Kategorije su ista lista oznaka kao u kalendaru.
- Forma „Novi posao“: počinje izborom klijenta. Dok se kuca ime (od prvog slova), ispod polja se prikazuju klijenti iz baze koji odgovaraju unosu i izabranoj vrsti (za „Pravno lice“ samo pravna lica, za „Fizičko lice“ samo fizička), a poslednja stavka je „+ Dodaj novog“. Izbor postojećeg klijenta popunjava sva njegova polja i zaključava ih (menjaju se samo na kartici klijenta). „Drugi klijent“ poništava izbor. Ako se izabere „+ Dodaj novog“ ili se samo upiše novo ime, pri čuvanju se pravi i novi klijent.
- Adresa posla: posao može da ima svoju adresu (ulica i broj, mesto), za fizičko i za pravno lice. U formi posla se uključuje sa „Posao je na drugoj adresi“. Ako nije upisana, koristi se adresa klijenta. Lista poslova i dugme za navigaciju (Google mape) koriste adresu posla.
- Kartica posla: klijent (link na njegovu karticu), telefon, adresa posla sa dugmetom za navigaciju (i adresa klijenta ako se razlikuje), početak, status, opis, slike i termini tog klijenta.
- Datum početka posla i status: Na čekanju, U procesu ili Završeno. Status se menja na kartici posla. Novi posao je na čekanju.
- Uz datum početka može da se upiše i vreme početka (nije obavezno). Prikazuje se kao „Početak 4. nov 2026. u 08:00“.
- Kad dođe datum početka (a ako je upisano vreme, kad dođe i to vreme tog dana), a posao je još Na čekanju, aplikacija pri ulasku pita: „Da li da prebacim [klijent] · [kategorija] u U procesu?“. „Prebaci“ menja status (ide u logove), „Ne sada“ ne menja ništa. Svaki korisnik dobija pitanje jednom za isti datum početka. Ako se datum početka promeni, pitanje dolazi ponovo. Više takvih poslova se pita jedan po jedan.
- U mobilnoj aplikaciji ovo pitanje mora da stigne i kao push notifikacija, i kad aplikacija nije otvorena (vidi roadmap, Faza 2).
- Status „Čeka uplatu“: posao je urađen, ali novac još nije stigao (važi i za fizička i za pravna lica). Statusi posla su: Na čekanju, U procesu, Čeka uplatu, Završeno. U prozoru naplate dugme „Čeka se uplata“ upisuje očekivane stavke (firma ili keš, iznos, opis) na posao; one ne ulaze u Promet dok uplata ne stigne. Za stavke preko firme faktura može odmah da se preuzme i pošalje. Kartica posla pokazuje „Čeka uplatu“ sa iznosima, fakturama i dugmetom „Uplata stigla“, koje otvara isti prozor popunjen očekivanim stavkama; „Naplaćeno, završi posao“ tada upisuje prihode (broj fakture ostaje isti) i završava posao. Komentar ostavljen u prozoru ide u komentare posla i drugi korisnik dobija obaveštenje.
- Kad uplata stigne: na kartici posla dugme „Uplaćeno, posao završen“ traži potvrdu („Da li je stigla uplata od … RSD?“), upisuje očekivane stavke u Promet i završava posao. „Izmeni iznose“ otvara prozor naplate ako je stiglo drugačije od očekivanog.
- Podsetnik za uplatu: posao u statusu „Čeka uplatu“ može imati podsetnike (datum, vreme, kome: samo meni ili oba korisnika, napomena). Kad dođe vreme, podsetnik stiže kao obaveštenje u zvonce („Podsetnik: čeka se uplata“, klik otvara posao); u pravoj aplikaciji i kao push/email po ličnim podešavanjima. Podsetnici se brišu sa kartice, a posle uplate više ne stižu. Dodavanje i brisanje ide u logove.
- Komentari na poslu: kartica posla ima komentare, isto kao zadatak (ko, kada, tekst, odgovori). U prozoru „Naplata posla“ postoji polje Komentar (nije obavezno) koje ide u komentare posla.
- Naplata pri završavanju: kad se posao prebaci u Završeno, otvara se „Naplata posla“. Bira se jedna ili više stavki (Keš, Poznan Drill, Poznan Trans…), svaka sa svojim iznosom i opisom; prikazuje se ukupno. „Završi i upiši naplatu“ pravi po jedan prihod za svaku stavku (danas, klijent posla, firma ili keš, veza na posao), „Završi bez naplate“ samo završava posao. Kartica posla pokazuje „Naplaćeno“ ukupno i po stavkama.
- Posao sa statusom Završeno ide u arhivu i dobija datum završetka. Vraćanjem na drugi status izlazi iz arhive.
- Lista „Poslovi“ prikazuje samo aktivne poslove, sortirane po datumu početka. Prvo idu poslovi koji počinju danas ili kasnije, od najbližeg ka daljem. Zatim idu već započeti, od najskorijeg ka najstarijem. Poslovi bez datuma su na kraju.
- Između dva susedna reda prikazuje se razlika u danima između njihovih datuma početka (npr. „3 dana razlike“, ili „Isti dan početka“).
- Datum završetka se upisuje pri arhiviranju (današnji datum), može da se ispravi u izmeni posla i briše se kad se posao vrati iz arhive. Ne može biti pre početka.
- Ikonica arhive u zaglavlju otvara prikaz „Arhiva“ sa završenim poslovima, uz dugme za nazad. Svaki red u arhivi pokazuje i datum početka i datum završetka. Pretraga i filter kategorije rade i tamo.
- Red u listi: ime klijenta i kategorija, adresa posla (ili adresa klijenta ako posao nema svoju), datum početka, a skroz desno dva dugmeta: navigacija (otvara Google mape sa adresom i mestom posla) i poziv.
- Na kartici posla nema posebne liste usluga. Transakcije se i dalje vide u Prometu, a ukupna naplata na kartici.
- Usluge klijentu su transakcije tipa prihod. Mogu ići preko bilo koje firme (faktura) ili bez firme (keš bez računa).
- Termini u kalendaru su odvojeni od poslova: termin je jedan dolazak (datum, vreme, ko radi) i vezan je za klijenta.

## Transakcija (promet)
- tip: `prihod` | `trosak`; iznos (RSD, bez PDV-a); datum; firma (opciono); klijent (opciono); kategorija; način naplate (`faktura` | `kes`); PDV stopa; opis.
- Faktura se pravi samo dok posao čeka uplatu: za svaku očekivanu stavku preko firme (klijent fizičko ili pravno lice) postoji „Faktura“ (posle „Čeka se uplata“ i na kartici posla u delu „Čeka uplatu“); za keš ne postoji. Kad je posao naplaćen i završen, faktura se više ne nudi; broj već izdate fakture ostaje na prihodu i vidi se na kartici posla i u izmeni unosa. Kod fizičkog lica faktura umesto PIB-a i MB-a ima oznaku „Fizičko lice“. Faktura ima izdavaoca (naziv, adresa, PIB, MB, delatnost), kupca (naziv, adresa, PIB, MB), broj po firmi i godini (npr. `DR-2026-001`), datume, stavku i ukupno; za paušal napomenu da obveznik nije u sistemu PDV-a. Broj se dodeljuje pri prvom preuzimanju i ostaje isti. Otvara se kao stranica za štampu ili čuvanje kao PDF. U pravoj aplikaciji: PDF iz Edge Function-a, kasnije slanje na SEF.
- Transakcija može biti vezana za posao (`jobId`) i imati broj fakture (`invoiceNo`).
- Način naplate se ne bira u formi. Bez firme je uvek keš bez računa, a sa firmom uvek preko računa.
- U formi unosa firma se bira dodirom na karticu (kao radio dugme), ne iz padajuće liste. Prva kartica je „Bez firme (keš)“ sa ikonicom novca i podrazumevano je izabrana za novi unos. Ostale kartice su aktivne firme sa svojom ikonicom ili logom.

## Kategorije poslova
- Zajednička lista za Poslove i termine u kalendaru (npr. Bušenje bunara, Prevoz). Upravlja se u Podešavanjima.
- Svaka kategorija ima naziv (jedinstven) i boju od šest ponuđenih. Boja se menja direktno pored kategorije i u izmeni. Dodavanje, izmena i brisanje idu u logove.
- Brisanje kategorije ne briše poslove, samo im uklanja kategoriju.

## Posao (kalendar)
- datum, vreme od i do, kratak opis, oznaka (npr. Prevoz, Bušenje bunara), ko radi (`nenad`, `jovan`, `oba`), klijent (opciono), firma (opciono), napomena, status završen.
- Oznake su kategorije poslova. Nova se dodaje u Podešavanjima ili direktno iz forme posla.
- Prikazi: mesec, nedelja, dan, uz filter po osobi. Početna strana prikazuje sledećih 5 poslova.
- Iz posla se može otvoriti unos prihoda (naplata) sa popunjenim klijentom, firmom i opisom.

## Zadatak
- naziv, ko je zadužen (`nenad`, `jovan`, `oba`), rok (opciono), vezan za posao (opciono), napomena, status (Na čekanju, U procesu, Završeno; kod završenog i kada i ko).
- Komentari: svaki zadatak i svaki posao imaju komentare (ko, kada, tekst). Na svaki komentar može da se odgovori („Odgovori“); odgovori se prikazuju uvučeno ispod komentara (jedan nivo). Odgovor šalje obaveštenje drugom korisniku („… je odgovorio na komentar“). Brisanje komentara briše i odgovore na njega. Pišu se u kartici zadatka (izmena zadatka) i čuvaju odmah, bez dugmeta „Sačuvaj zadatak“. Svako može da obriše samo svoj komentar. Dodavanje i brisanje komentara ide u logove. Na listi zadataka pored zadatka stoji broj komentara.
- Obaveštenja u aplikaciji: zvonce gore desno na svakom ekranu, sa brojem nepročitanih za prijavljenog korisnika. Kad jedan korisnik ostavi komentar na zadatku, drugi dobija obaveštenje („Jovan je komentarisao zadatak“, naziv zadatka, tekst, vreme). Klik otvara taj zadatak i skroluje do komentara, koji se kratko istakne. Otvaranje zadatka označava njegova obaveštenja kao pročitana; postoji i dugme „Označi sve kao pročitano“. Lista prikazuje samo nepročitana obaveštenja; kad ih nema, piše „Nema novih obaveštenja.“ Brisanje komentara briše i njegovo obaveštenje.
- Zadatak nema svoje polje za klijenta. Ako je vezan za posao, klijent se vidi preko tog posla.
- „Vezan za posao“ je polje sa pretragom: dok se kuca, prikazuju se odgovarajući termini (datum, vreme, vrsta, klijent). Podrazumevano ništa nije izabrano; „×“ briše izbor.
- Status se bira u formi zadatka. Kvačica na listi otvara potvrdu „Završi zadatak?“, pa tek onda prebacuje na Završeno. Ponovni klik na završen zadatak ga odmah vraća na raniji status. Svaka promena statusa ide u logove.
- Lista je grupisana na: kasni, danas, narednih 7 dana, kasnije, bez roka. Filteri u dva reda sa naslovima. „Osobe“: Svi, po osobi, Zajednički. „Statusi“: Svi (otvoreni, uz dugme „Završeni“), Na čekanju, U procesu, Završeno, sa brojem zadataka za izabranu osobu.

## Logovi (audit)
- Zapis: vreme, korisnik, entitet (`posao`, `zadatak`, `klijent`, `firma`, `transakcija`, `podesavanja`, `backup`, `nalog`), akcija, naziv, lista promena (polje, staro, novo).
- Prikaz: lista grupisana po danima, filteri po entitetu, korisniku, periodu i tekstu.

## Backup
- Na Google Drive svakih N dana (podrazumevano 3). Čuva se poslednjih 10.
- Sadrži export svih tabela i slike klijenata.
