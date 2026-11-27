# Poprawki po wdrożeniu listy zakupów i kont gości

Baza: branch `em` (commit d47d746 „Add shopping list section and keep guest accounts on leave”).

## 1. Domyślne wartości sekcji „Lista zakupów”

Stan obecny (`supabase/migrations/20261127100100_shopping_list.sql`, `insert_default_event_sections`):
sekcja ma `is_visible = false`, eyebrow „Pomóż nam”, w menu „Lista” (`src/config/navigation.ts`),
ustawienia: opis ✔, ilość ✘, kto dodał ✔, przypisywanie ✔.

Zmiany:
- sekcja domyślnie wyłączona - zostaje `is_visible = false` (sprawdzić w bazie em, czy istniejące
  wydarzenia nie dostały `true`; jeśli tak - poprawić w migracji),
- nazwa w menu: `'Lista'` → `'Lista zakupów'` w `SECTION_NAV_ITEMS` oraz `navLabelPlaceholder`
  w `ShoppingListEditor.tsx`,
- napis nad tytułem: eyebrow `'Pomóż nam'` → `null`,
- „Kto dodał” domyślnie włączone - już jest (`show_author default true`,
  `DEFAULT_SHOPPING_SETTINGS.showAuthor = true`); do sprawdzenia, czy w bazie em wiersze
  `event_shopping_settings` nie mają `false`.

Migracja `20261127100100_shopping_list.sql` nie jest wdrożona na bazę em (prod) - poprawka
w tym pliku, bez nowej migracji. Lokalnie `supabase db reset`. Aktualizacja testów
`supabase/tests/13_shopping_list.test.sql` / `08_event_page_config.test.sql`.

## 2. Pola formularza zgodne z konfiguracją, większe nicki

- `ShoppingItemForm`: już ukrywa ilość/jednostkę przy `showQuantity = false` - do weryfikacji,
  że w formularzu gościa nie widać ich przy domyślnych ustawieniach. Panel organizatora
  (`showAllFields`) też ma respektować ustawienia → usunąć wymuszanie pól ilości w formularzu
  dodawania w `ShoppingManagementPanel` (zostawić tylko podgląd zapisanych danych, jeśli są).
  Domyślnie formularz = „Co trzeba kupić lub przynieść?” + „Opis”.
- `ShoppingItemCard`: wiersz autora / osoby przypisanej z `text-xs` na `text-sm`, same nicki
  `font-semibold` (ewentualnie pigułka `rounded-full bg-muted px-2`) - czytelne na ciemnym tle.

## 3. Migający checkbox na ciemnym motywie

Natywne `<input type="checkbox" class="accent-primary">` (`ShoppingItemForm` - „Przypisz do mnie”,
`ShoppingListSection` - „Tylko wolne”) w `color-scheme: dark` - Chrome przelicza kolor
`accent-color` przy hover/focus i na półprzezroczystym tle karty z `backdrop-blur` widać mignięcie.

Poprawka: nowy komponent `src/components/ui/checkbox.tsx` (input `appearance-none`, ramka
`border-input`, zaznaczenie `bg-primary` + ikona `Check`, bez przejść koloru) i użycie go w obu
miejscach listy zakupów. Weryfikacja w przeglądarce na ciemnym motywie (hover, klik, focus).
Pozostałe natywne checkboxy (goście, plan sali) - osobno, jeśli też migają.

## 4. Okno „Wyjść z wydarzenia?”

`LeaveEventDialog.tsx`: zostaje tylko górna informacja, bez wzmianki o zdjęciach:
„Na tym urządzeniu zapamiętamy Twój pseudonim. Po ponownym wpisaniu kodu wrócisz od razu na to
samo konto.” Usunięta ramka i tekst „Korzystasz z cudzego telefonu…”; przycisk
„To nie moje urządzenie - wyjdź całkowicie” zostaje w oknie, bez ramki (np. obok/pod przyciskami).

## 5. Połączenie konta anonimowego z Google

Nowa akcja w nagłówku (`SiteHeader`) i `ManagementLayout` dla `isAnonymous`:
„Połącz z kontem Google”.

### 5a. Nowe konto Google (najczęstszy przypadek) - powiązanie, bez scalania

- `src/lib/eventApi.ts`: `linkGoogleAccount(returnPath)` → `supabase.auth.linkIdentity({ provider:
  'google', options: { redirectTo } })` - to samo konto (ten sam `user.id`), więc zdjęcia, wpisy
  i pozycje listy zostają bez przepisywania danych.
- Nazwa z Google: wpisy pokazują `profiles.display_name` przez klucz obcy, więc wystarczy zmienić
  nazwę w profilu - wszystkie wpisy, zdjęcia i przypisania od razu pokażą nazwę z Google.
  Zmiana w `handle_auth_user_updated` (nowa migracja - auth_sync jest już na prodzie): gdy
  `old.is_anonymous and not new.is_anonymous`, `display_name = coalesce(clean_display_name(full_name
  / name z Google), p.display_name)` (pseudonim tylko gdy Google nie poda nazwy). E-mail
  i `is_anonymous = false` trigger przepisuje już teraz.
- `supabase/config.toml` ma `enable_manual_linking = true`; to samo trzeba włączyć w panelu
  Supabase dla bazy em (Auth → Providers → „Allow manual linking”).
- Po powrocie: odświeżenie profilu w `useEventSession` (`isAnonymous` → false, etykieta konta).

### 5b. Konto Google już istnieje (`identity_already_exists`) - scalanie

Supabase nie pozwala dołączyć tożsamości, która ma już swoje konto, więc trzeba przenieść dane
z konta anonimowego na konto Google:

1. Przed przekierowaniem (sesja anonimowa) RPC `create_account_merge_token()` - jednorazowy,
   krótko ważny (np. 10 min) token w tabeli `account_merge_tokens(token, anon_user_id, expires_at)`,
   zapamiętany w `sessionStorage`.
2. `signInWithGoogle` - logowanie na istniejące konto Google.
3. Po powrocie RPC `merge_anonymous_account(token)` (security definer, wywołujący = konto Google,
   konto z tokenu musi być nadal anonimowe): przepina `created_by` / `uploaded_by` / `assigned_to` /
   `user_id` (pozycje listy, zdjęcia, wydatki, goście, członkostwa) z konta anonimowego na konto
   Google. Konflikty: członkostwo w tym samym wydarzeniu - zostaje wyższa rola z obu; limit 50
   pozycji na osobę - scalanie przechodzi mimo limitu (liczony tylko przy dodawaniu). Na końcu
   usunięcie konta anonimowego (`auth.users`) i tokenu.
4. Pliki zdjęć w storage - sprawdzić, czy ścieżka zawiera `user_id`; jeśli tak, zostają
   (właściciel w tabeli `photos` się zmienia, polityki storage do sprawdzenia).
5. Testy pgTAP: przeniesienie danych, cudzy/przeterminowany token, token konta nieanonimowego.

Przy błędzie scalania - komunikat i konto Google bez danych z pseudonimu (konto anonimowe
nienaruszone, można wrócić kodem). Etap 5b jest większy - proponuję zrobić 5a w tej paczce,
5b jako osobny krok.
- Obsługa błędu z redirectu (`readAuthRedirectErrorCode`) na ekranie wydarzenia.

## 6. Zwijany formularz dodawania

`ShoppingListSection`: zamiast stałej karty z formularzem - przycisk „+ Dodaj produkt”
(domyślnie zwinięte). Klik rozwija kartę z `ShoppingItemForm` (focus na polu nazwy),
przycisk „Anuluj” (`onCancel`) zwija. Po dodaniu pozycji formularz zostaje rozwinięty
(łatwe dodawanie kilku rzeczy). `aria-expanded` / `aria-controls` na przycisku.

## Weryfikacja

`npm run lint`, `npm run build`, testy pgTAP (`supabase test db`), ręcznie w przeglądarce:
jasny i ciemny motyw, mobile, gość anonimowy (wyjście, połączenie z Google), organizator.
