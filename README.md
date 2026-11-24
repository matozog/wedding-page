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

Lokalnie działa logowanie anonimowe. Logowanie przez Google wymaga dodatkowej konfiguracji
`[auth.external.google]` w `supabase/config.toml`.

Adresy lokalnego stacku: API http://127.0.0.1:54321, Studio http://127.0.0.1:54323.

## Deploy

Branch `em` → `em.ozogowie.pl` (Cloudflare Worker `wedding-page-em`):

```sh
npm run build
npx wrangler deploy --env em
```
