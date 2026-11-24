# Wedding page

Strona wesela: React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui, dane i logowanie w Supabase.

## Uruchomienie lokalne

Wymagania: Node.js 24+, Docker Desktop (uruchomiony).

```sh
npm install
npm run dev:local
```

`dev:local` sprawdza Dockera, uruchamia lokalny stack Supabase (jeśli jeszcze nie działa),
tworzy `.env.development.local` z publiczną konfiguracją lokalnego stacku (jeśli go brak)
i startuje Vite na http://localhost:5173. Kod testowego wydarzenia z `supabase/seed.sql`: **TEST123**.

Pierwszy start pobiera obrazy Dockera i trwa kilka minut.

| Skrypt | Opis |
| --- | --- |
| `npm run dev:local` | Supabase + Vite jedną komendą |
| `npm run dev:local:reset` | jak wyżej, ale najpierw reset lokalnej bazy (migracje + seed) |
| `npm run db:start` / `db:stop` / `db:status` | sterowanie lokalnym stackiem Supabase |
| `npm run db:reset` | ponowne wgranie migracji i seeda do lokalnej bazy |
| `npm run db:test` | testy pgTAP z `supabase/tests` |
| `npm run db:types` | regeneracja `src/types/database.ts` ze schematu |
| `npm run lint` / `npm run build` | Oxlint / sprawdzenie typów i build |

Po zamknięciu Vite Supabase dalej działa — zatrzymasz go przez `npm run db:stop`.

Adresy lokalnego stacku: API http://127.0.0.1:54321, Studio http://127.0.0.1:54323.

## Lokalne logowanie przez Google

Logowanie anonimowe działa od razu. Google jest włączone w `supabase/config.toml`
(`[auth.external.google]`), ale wymaga własnego klienta OAuth:

1. W [Google Cloud Console](https://console.cloud.google.com/) → Google Auth Platform → Clients
   utwórz klienta OAuth do pracy lokalnej (typ **Web application**), osobnego niż produkcyjny:
   - Authorized JavaScript origins: `http://localhost:5173`, `http://127.0.0.1:5173`
   - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`

   W trybie *Testing* zalogują się tylko konta dodane w **Audience → Test users**.
2. Skopiuj `supabase/.env.example` do `supabase/.env` (ignorowany przez git) i wpisz Client ID
   oraz Client secret. Nie wpisuj ich do `.env*.local` ani zmiennych `VITE_*`.
3. Zrestartuj stack, żeby wczytał konfigurację — `dev:local` nie restartuje działającego Supabase:

   ```sh
   npm run db:stop
   npm run dev:local
   ```

4. Otwórz http://localhost:5173, wpisz kod `TEST123` i wybierz „Zaloguj się przez Google”.

Aplikacja musi działać na porcie 5173 — jeśli Vite wybierze inny port (bo 5173 jest zajęty),
Supabase odrzuci powrót z Google.

## Deploy

Branch `em` → `em.ozogowie.pl` (Cloudflare Worker `wedding-page-em`):

```sh
npm run build
npx wrangler deploy --env em
```
