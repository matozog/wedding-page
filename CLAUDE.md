# Instrukcje projektu dla Claude Code

## Zasady obowiązkowe

1. Przed implementacją przejrzyj kod i konfigurację w trybie odczytu. Przedstaw plan zawierający zakres, główne zmiany, wpływ na bazę i uprawnienia, jeśli dotyczy, oraz sposób weryfikacji. Poczekaj na wyraźne zatwierdzenie planu przez użytkownika, zanim zmienisz pliki. Gdy zakres istotnie się zmieni, przedstaw zaktualizowany plan do akceptacji.
2. Przed dodaniem biblioteki, także deweloperskiej, uzgodnij to z użytkownikiem. Wyjaśnij, do czego jest potrzebna i co można zrobić istniejącymi narzędziami. Dotyczy to także zależności dodawanych przez generatory komponentów shadcn/ui. Jeśli brakuje React Hook Form, zgłoś to w planie i uzgodnij instalację.
3. Twórz commity i wykonuj push wyłącznie na wyraźną prośbę użytkownika. Zatwierdzenie planu oznacza zgodę na implementację w ustalonym zakresie. Zachowaj bieżące zmiany użytkownika.
4. Buduj formularze za pomocą React Hook Form (RHF).

## Stack

- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS 4 i shadcn/ui. W warstwie UI używaj istniejących komponentów i narzędzi projektu: Radix UI, `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`, Embla Carousel i `yet-another-react-lightbox`.
- Lint: Oxlint.
- Dane i uwierzytelnianie: Supabase, Postgres 17, RLS, RPC, logowanie anonimowe i przez Google, Storage na zdjęcia oraz `@supabase/supabase-js`. Do pracy lokalnej i migracji używaj Supabase CLI i Dockera.
- Cloudflare Worker z Hono jest planowany. Uwzględniaj go w implementacji dopiero po zatwierdzeniu zadania, które go wprowadza.

## Organizacja kodu

| Katalog | Odpowiedzialność |
| --- | --- |
| `components/` | Generyczne komponenty wielokrotnego użytku. Zależności i akcje przekazuj przez propsy. |
| `store/` | Stan klienta współdzielony w aplikacji, reducery, akcje i selektory zgodnie z istniejącą konwencją. |
| `views/` | Widoki aplikacji, składanie komponentów i obsługa przepływów danego ekranu. |
| `api/` | Integracje zewnętrzne, w tym klient Supabase, zapytania, RPC, Auth i Storage. Korzystaj z istniejącego klienta. |

Umieszczaj te katalogi w obrębie istniejącej struktury źródeł. Zachowuj lokalny stan pojedynczego widoku lub komponentu blisko miejsca użycia. Widoki i ich hooki korzystają z modułów `api/`. Generyczne komponenty pozostają niezależne od widoków i integracji.

## Frontend i formularze

- Zachowuj istniejące konwencje TypeScriptu, importów i nazw. Używaj typów Supabase generowanych z bazy dla zapytań i RPC, jeśli projekt je udostępnia. Po zmianie schematu odśwież te typy zgodnie z komendą projektu.
- Używaj istniejących komponentów shadcn/ui, tokenów projektu i helpera do łączenia klas. Przy zmianach UI sprawdź wąski ekran, obsługę klawiaturą, widoczność fokusu oraz etykiety pól i przycisków z samą ikoną.
- W RHF określ typ danych i wartości początkowe. Stosuj `register` dla standardowych pól oraz `Controller` w razie potrzeby dla komponentów kontrolowanych. Pokaż błędy przy polach i informację o nieudanym zapisie. Zabezpiecz formularz przed podwójnym wysłaniem.
- Obsługuj odpowiednie dla widoku stany ładowania, braku danych i błędu. Walidację istotną dla bezpieczeństwa i spójności danych egzekwuj także po stronie bazy lub serwera.

## Supabase

- Zapisuj zmiany schematu, RLS i RPC jako nowe migracje w `supabase/migrations/`. Migrację, która została już zastosowana w środowisku współdzielonym, koryguj następną migracją. Weryfikuj zmiany na lokalnym stacku. Przed operacją na zdalnej bazie, zmianą środowiska docelowego lub resetem danych uzyskaj wyraźną zgodę.
- Dla tabel dostępnych przez Data API włącz RLS i ogranicz uprawnienia oraz polityki do potrzebnych operacji. Rozróżniaj brak sesji (rola `anon`) od zalogowanego użytkownika anonimowego (rola `authenticated`, flaga JWT `is_anonymous`). Uprawnienia sprawdzaj w bazie, również gdy UI ukrywa daną akcję.
- Dla RPC preferuj `SECURITY INVOKER`. Gdy potrzebny jest `SECURITY DEFINER`, uzasadnij podniesienie uprawnień w planie, ustaw bezpieczny `search_path`, kwalifikuj nazwy obiektów schematem, zawęź `EXECUTE` i zweryfikuj uprawnienie wywołującego do konkretnego rekordu.
- Dla zdjęć sprawdzaj uprawnienia do przesyłania, odczytu i usuwania obiektów. Używaj prywatnych bucketów i podpisanych adresów URL dla zdjęć wymagających kontroli dostępu. Ustal limity rozmiaru i dozwolone typy plików po stronie Storage lub serwera.
- Do frontendu przekazuj wyłącznie publiczną konfigurację Supabase, w tym adres projektu i klucz publishable lub istniejący klucz publiczny `anon`. Trzymaj klucze `service_role`, klucze secret i sekret Google OAuth poza frontendem oraz zmiennymi `VITE_*`. W przykładach konfiguracji wpisuj wartości zastępcze.

## Weryfikacja zmian

- Przed użyciem poleceń sprawdź `package.json`, plik blokady, README i istniejącą konfigurację. Używaj menedżera pakietów i skryptów repozytorium.
- Po zmianach kodu uruchom odpowiednie kontrole, w tym Oxlint, sprawdzenie typów, build Vite i istniejące testy, zależnie od zakresu oraz dostępnych skryptów. Obejrzyj `git diff` i `git status`.
- Przy zmianach uprawnień sprawdź lokalnie dozwolone i zabronione operacje. Uwzględnij, zależnie od funkcji, brak sesji, sesję anonimową, konto Google oraz próbę dostępu do rekordu lub zdjęcia innego użytkownika.
- W podsumowaniu opisz zmiany, wyniki wykonanych kontroli i elementy, których nie udało się zweryfikować.
