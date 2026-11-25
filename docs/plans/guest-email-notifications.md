# Plan: wysyłka e-maili do gości (zaproszenia, przypomnienia)

Stan na 2026-11-25. Plan do wczytania w kolejnej sesji. Zanim zaczniesz implementację, przedstaw
użytkownikowi plan danego etapu do akceptacji (CLAUDE.md, zasada 1).

## Etap 1 — zrobione (gałąź `claude/guest-email-field`, od `em`)

- Migracja `supabase/migrations/20261125143000_guest_email.sql`: ograniczenie `guests_email_format`
  (format jak `event_contacts.email`, adres zapisany małymi literami, limit 254 z wcześniejszej migracji).
- Test `supabase/tests/10_guest_email.test.sql`: format, ADMIN zapisuje, EDITOR czyta, gość/obcy nie widzą.
- Front: pole „E-mail” w `GuestEditSheet` i w drugim wierszu `GuestEditRow`. W tabeli tylko ikona ✉
  przy telefonie, adres w podpowiedzi. Na kartach (wąski ekran) adres pokazany, gdy jest.
  E-mail w wyszukiwarce i filtr „Z e-mailem / Bez e-maila”, widoczny dopiero, gdy ktoś ma adres.
- E-mail zostaje w `guests`, tak jak telefon: EDITOR go widzi i (od `20261125130000_seating_layout`)
  może edytować, bo EDITOR dodaje i edytuje gości. Dla gości bez roli `get_seating_plan()` zwraca
  tylko imiona. Ukrycie przed EDITOR-em wymagałoby
  osobnej tabeli `guest_contacts` z RLS tylko dla ADMIN-a. Wróć do tego, jeśli użytkownik tego zechce.

## Punkty wyjścia w kodzie

- `guests.email`, `guests.user_id` (powiązanie z kontem; przyda się w etapie 4), `events.starts_at`.
- `pg_cron` jest już włączony (`20261121100700_deferred_guest_profiles.sql`).
- Lokalny Supabase ma skrzynkę testową (`[local_smtp]` w `supabase/config.toml`, UI: http://127.0.0.1:54324,
  port SMTP `smtp_port` jest zakomentowany i trzeba go odkomentować, żeby funkcja wysyłała tam maile).
- Filtry listy gości (`src/lib/guestList.ts`: obecność, „od kogo”, e-mail, wyszukiwarka) można użyć
  do wyboru odbiorców.
- Motywy wydarzenia: `src/config/themes.ts` (kolory do szablonu maila).

## Etap 2 — ręczna wysyłka zaproszeń i wiadomości (ok. 3–5 dni)

### Decyzje do podjęcia z użytkownikiem przed startem

1. **Gdzie działa wysyłka:** Supabase Edge Function (zalecane: blisko bazy, ta sama sesja JWT,
   sekrety w Supabase, łatwe wywołanie z `pg_cron` przez `pg_net`) albo Cloudflare Worker z Hono
   (jest w planach według CLAUDE.md, ale wymaga osobnej zgody i samodzielnej weryfikacji sesji Supabase).
2. **Dostawca poczty:** Resend, Brevo lub Postmark. Przy ok. 150 gościach darmowy plan
   prawdopodobnie wystarczy. Sprawdź aktualne limity przed wyborem. Wolę wywołanie API przez `fetch`
   niż SDK (bez nowej zależności). Każdą zależność uzgodnij (CLAUDE.md, zasada 2).
3. **Domena nadawcy:** np. `zaproszenia@ozogowie.pl`. W DNS Cloudflare trzeba dodać SPF, DKIM
   i DMARC według instrukcji dostawcy. Bez tego maile trafią do spamu. To robi użytkownik w swoim koncie.
4. **Gospodarstwa domowe:** proponuję usuwać duplikaty adresów w obrębie grupy przy wysyłce
   (jeden mail na rodzinę z tym samym adresem), bez nowego pola na grupie.

### Baza (nowa migracja)

- `email_messages`: `id`, `event_id`, `kind` (enum `INVITATION` / `REMINDER` / `CUSTOM`), `subject`,
  `body` (tekst ze zmiennymi), `created_by`, `created_at`, `scheduled_at` (null = od razu),
  `status` (`DRAFT` / `QUEUED` / `SENDING` / `DONE` / `FAILED`).
- `email_deliveries`: `id`, `message_id`, `guest_id` (null przy usuniętym gościu, `on delete set null`),
  `email` (kopia adresu), `status` (`QUEUED` / `SENT` / `FAILED` / `SKIPPED`), `provider_message_id`,
  `error`, `sent_at`. Unikalność `(message_id, email)` zapewnia usuwanie duplikatów i idempotencję.
- RLS: SELECT dla ADMIN-a wydarzenia. Klient nie zapisuje statusów, robi to tylko funkcja (service role).
- RPC `queue_email_message(event_id, kind, subject, body, guest_ids[], scheduled_at)` jako
  `SECURITY INVOKER`: sprawdza rolę ADMIN, zakłada wiadomość i doręczenia dla gości z e-mailem.
- Limit wysyłek na wydarzenie na dobę (np. 500 adresów), żeby błąd lub przejęte konto nie rozesłało spamu.

### Edge Function `send-emails`

- Wejście: `message_id`. Sprawdza JWT wywołującego i rolę ADMIN dla wydarzenia tej wiadomości
  (albo wywołanie z `pg_cron` z sekretem).
- Pobiera doręczenia `QUEUED`, podstawia zmienne (`{imię}`, `{nazwa_wydarzenia}`, `{data}`, `{link}`, `{kod}`),
  wysyła paczkami (batch API dostawcy), aktualizuje statusy. Ponowne uruchomienie wysyła tylko `QUEUED`.
- Sekrety (`RESEND_API_KEY` itd.) w `supabase secrets`, nigdy w `VITE_*`.
- Lokalnie: wysyłka przez SMTP do skrzynki testowej Supabase albo w trybie testowym dostawcy.

### Front

- Nowa trasa `/management/messages` (widok „Wiadomości”) w `ManagementLayout`, tylko dla ADMIN-a.
- Formularz w RHF: rodzaj, temat, treść ze zmiennymi, wybór odbiorców (filtry listy gości +
  ręczne zaznaczanie), licznik „X osób, Y adresów po usunięciu duplikatów, Z bez e-maila”.
- Podgląd maila dla wybranego gościa przed wysłaniem. Potwierdzenie wysyłki.
- Historia wiadomości ze statusami doręczeń i przyciskiem ponowienia nieudanych.
- Szablon HTML: prosty, ze stylami inline (maile mają ograniczony CSS), kolory z motywu wydarzenia.

### Testy

- pgTAP: RLS na nowych tabelach i RPC dla braku sesji, gościa, EDITOR-a, ADMIN-a innego wydarzenia
  i ADMIN-a wydarzenia; usuwanie duplikatów; limit dobowy.
- Ręcznie: wysyłka lokalna do skrzynki testowej, podgląd na wąskim ekranie.

## Etap 3 — automatyczne przypomnienia (ok. 1–2 dni, po etapie 2)

- Zadanie `pg_cron` co 5 minut wywołuje przez `pg_net` funkcję dla wiadomości z `scheduled_at <= now()`
  i statusem `QUEUED`. Przejście statusu na `SENDING` w jednej transakcji (`for update skip locked`),
  żeby nie wysłać dwa razy.
- Gotowe ustawienia: „7 dni przed” i „1 dzień przed”, liczone od `events.starts_at`
  (uwaga na strefę czasową: `Europe/Warsaw`). Opcjonalnie tylko do osób z obecnością `CONFIRMED` / `LIKELY`.
- Zmiana `events.starts_at` powinna przeliczyć zaplanowane przypomnienia albo ostrzec ADMIN-a.
- Wypisanie się: `guests.email_opt_out boolean` + losowy token w linku „nie chcę przypomnień”.
  Obsługa przez RPC dostępne bez logowania (`anon`), z tokenem; `SECURITY DEFINER` z uzasadnieniem,
  bezpiecznym `search_path` i zawężonym `EXECUTE`. Zaproszenia (`INVITATION`) mogą pomijać opt-out,
  przypomnienia nie.

## Etap 4 (opcjonalnie) — spersonalizowane linki i samodzielne potwierdzanie obecności

- Link z jednorazowym tokenem (tabela `guest_invite_tokens`: hash tokenu, `guest_id`, ważność)
  zamiast wspólnego kodu dostępu. Otwarcie linku: logowanie anonimowe, dołączenie do wydarzenia
  i powiązanie wpisu przez `guests.user_id`.
- Gość sam ustawia swoją obecność (i ewentualnie osób z grupy). RLS/RPC tylko dla własnego wpisu.
- Zmienia model dostępu, więc wymaga osobnego planu, przeglądu bezpieczeństwa i testów uprawnień.

## RODO / prywatność

- Adresy gości trafiają do zewnętrznego dostawcy poczty: to przekazanie danych osobowych.
  Wybierz dostawcę z serwerami w UE albo z umową powierzenia (DPA).
- Link do wypisania się w przypomnieniach. Po wydarzeniu: możliwość wyczyszczenia e-maili
  i historii doręczeń (np. przycisk lub zadanie `pg_cron` po N dniach).
