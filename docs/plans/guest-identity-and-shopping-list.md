# Plan: stała tożsamość gościa + sekcja „Lista zakupów”

Baza: branch `em` (stan na `de544aa`), praca na `guest-identity-shopping-list`.
Dwie części, wdrażane w tej kolejności, bo lista przypisuje wpisy i osoby do
`user_id` i potrzebuje stabilnego konta gościa.

---

## Część A - gość nie traci konta przy zmianie pseudonimu / wyjściu

### Problem

Link „Zmień pseudonim / wyloguj” w `SiteHeader` woła `logout()` →
`supabase.auth.signOut()`. Sesja anonimowa (refresh token w localStorage)
znika, przy kolejnym wpisaniu kodu `ensureAuthSession()` robi nowe
`signInAnonymously()`, a gość podaje pseudonim i dostaje nowy profil
i nowe członkostwo. Stary profil zostaje (cron usuwa tylko konta **bez**
profilu). Efekt: duplikaty w `event_members`, a na liście gość straciłby
edycję swoich wpisów i przypisań.

### Cel

- Zmiana pseudonimu = zmiana `profiles.display_name` tego samego konta.
- „Wyjście” gościa anonimowego = powrót do ekranu kodu **bez** `signOut()`.
  Ponowne wpisanie kodu → od razu wydarzenie (ścieżka już istnieje
  w `checkCode`: jest profil → `joinWithCode`).
- Pełne wylogowanie konta anonimowego tylko świadomie (cudze urządzenie).

Bez zmian w bazie (`set_display_name` już istnieje).

### Kroki

1. **`src/hooks/useEventSession.ts`**
   - `leaveEvent()` - `updateStored(null)`, `updatePending(null)`,
     `setCode('')`, `setError(null)`; profil i nick zostają, **bez**
     `signOut()`.
   - `logout()` - bez zmian (pełne wylogowanie).
   - `changeNickname(value)` - walidacja 1-40 znaków, `setDisplayName`,
     `refreshProfile()`, przez `runExclusive`; zwraca `true/false`
     i ustawia błąd jak `saveNickname`.
   - Eksport `isAnonymous: profile?.isAnonymous ?? false`.
2. **`src/components/account/`** (zrealizowane jako dwa linki w nagłówku
   strony i ikona + przycisk w nagłówku zarządzania, bez nowej biblioteki
   menu; stan okien w `App.tsx`, `AccountContext`):
   - „Zmień pseudonim” → dialog (`components/ui/dialog`), pole jak
     w `NicknameScreen`, limit 40;
   - gość anonimowy: „Wyjdź z wydarzenia” → `confirm-dialog`:
     - główny przycisk „Wyjdź” → `leaveEvent` (konto zostaje, powrót kodem
       bez podawania nicka);
     - mały link pod spodem „To nie moje urządzenie - wyjdź całkowicie”
       → `logout`, z tekstem, że po tym na tym urządzeniu nie da się już
       edytować swoich wpisów ani przypisań.
       Po co: gdy ktoś wszedł z telefonu znajomego, a potem znajomy chce
       wejść jako on sam. Bez tej opcji kolejna osoba na tym telefonie
       weszłaby jako poprzednia (to samo konto i nick). Jedyna inna droga
       to wyczyszczenie danych strony w przeglądarce.
   - konto Google: „Wyloguj” (`logout`) jak dotąd.
3. **`SiteHeader.tsx`, `ManagementLayout.tsx`** - zamiast obecnego linku
   / przycisku `onLogout` wstawić `AccountMenu`. Propsy: `nickname`,
   `isAnonymous`, `onChangeNickname`, `onLeaveEvent`, `onLogout`.
4. **`App.tsx`** - przekazać nowe akcje do ekranów (EventGallery, Management,
   Guests, Expenses, Seating, EventConfig/EventsManagement przez `access`).
5. **Testy ręczne** (`npm run dev:local`):
   - gość: kod → nick → „Zmień pseudonim” → nick zmieniony, ten sam
     `user_id` w `profiles`;
   - „Wyjdź” → kod → od razu strona, bez ekranu nicka, brak nowego
     wiersza w `auth.users` / `profiles`;
   - inne wydarzenie innym kodem → to samo konto, drugie członkostwo;
   - „wyjdź całkowicie” → nowe konto, ekran nicka;
   - Google: „Wyloguj” działa jak dotąd; zmiana nazwy działa;
   - super admin: wybór wydarzenia z listy i wyjście (`onLeaveEvent`
     / `syncEventChange`) bez regresji.
6. `npm run lint`, `npm run build`.

### Poza zakresem (na później)

- Podpięcie Google do konta anonimowego (`supabase.auth.linkIdentity`,
  `enable_manual_linking = true` już jest w `config.toml`): to samo `user_id`
  na kilku urządzeniach, odporność na czyszczenie localStorage (iOS Safari
  ITP ~7 dni). Do rozwiązania: co, gdy ten Google ma już własne konto
  (`identity_already_exists`).
- Istniejące duplikaty - zostają; nie da się ich pewnie połączyć.

---

## Część B - sekcja „Lista zakupów”

Nie tylko zakupy - także „kto co przyniesie” (np. głośnik, krzesła). Rdzeń
wpisu to **rzecz i osoba, która się nią zajmie**.

### Założenia

- Sekcja strony jak pozostałe: włączana i edytowana przez super admina
  w `/events/{id}` (Sekcje strony): menu, nadtytuł, tytuł, opis, tekst
  pustej listy. **Domyślnie ukryta** w każdym wydarzeniu (nowym
  i istniejącym).
- Wpisy dodaje każdy członek wydarzenia. Autor edytuje / usuwa swoje;
  EDITOR, ADMIN i super admin - wszystkie (`has_event_role` już uwzględnia
  super admina).
- **Przypisanie** („kto się tym zajmie”): każdy członek może przypisać
  wolny wpis do siebie albo się z niego wypisać - nic więcej (nie przypisuje
  innych, nie przejmuje zajętego wpisu). Organizatorzy (EDITOR / ADMIN /
  super admin) mogą dodatkowo zwolnić czyjeś przypisanie (porządki).
  Przy dodawaniu wpisu: pole „Przypisz do mnie” (domyślnie odznaczone).
- Pola wpisu i informacje na liście są **konfigurowalne** w panelu
  (patrz „Opcje listy”).
- Bez kategorii, linków i odhaczania „kupione” - przypisanie wystarcza
  jako deklaracja.
- Uprawnienia egzekwuje baza (RLS + granty kolumn + RPC), UI tylko je
  odzwierciedla.

### Wpis

| Pole | Typ | Uwagi |
|---|---|---|
| nazwa | `name text not null`, 1-120 | zawsze |
| opis | `note text null`, 1-500 | opcjonalne (opcja listy) |
| ilość | `quantity integer null`, 1-999, w formularzu domyślnie 1 | opcjonalne (opcja listy) |
| jednostka | `unit text null`, 1-20 („szt.”, „kg”, „opak.”) | razem z ilością |
| kto dodał | `created_by uuid` | wyświetlanie opcjonalne |
| kto się zajmie | `assigned_to uuid null` | opcjonalne (opcja listy) |

Każdy wpis to osobny wiersz z `id` i `created_by`, więc dwie osoby z tym
samym nickiem niczego sobie nie nadpiszą. Nazwy osób z
`profiles.display_name` (pseudonim albo imię z Google).

### Opcje listy (panel super admina)

Przełączniki w edytorze sekcji, zapisywane w osobnej tabeli
`event_shopping_settings` (jeden wiersz na wydarzenie):

| Opcja | Domyślnie | Wyłączona |
|---|---|---|
| `show_note` - opis | wł. | brak pola w formularzu, opis nie jest pokazywany |
| `show_quantity` - ilość i jednostka | wył. | brak pól, ilość nie jest pokazywana |
| `show_author` - „dodał(a)” | wł. | autor nie jest pokazywany (uprawnienia bez zmian) |
| `allow_assign` - przypisywanie osób | wł. | brak „Przypisz do mnie” / „Biorę to” / „Rezygnuję”; RPC przypisania odmawia |

Wyłączenie opcji tylko ukrywa dane - nic nie jest kasowane, ponowne
włączenie przywraca widok. Przypisywanie jest egzekwowane w bazie
(wyłączone → RPC zwraca błąd), pozostałe opcje to tylko widok.

### B1. Migracje

1. **`20261127100000_shopping_section_enum.sql`** - osobny plik, bo nowej
   wartości enuma nie można użyć w tej samej transakcji:
   ```sql
   alter type public.event_section add value 'shopping' before 'location';
   ```
2. **`20261127100100_shopping_list.sql`**
   - `create or replace function public.insert_default_event_sections` -
     dopisać `(p_event_id, 'shopping', false, 'Pomóż nam', 'Lista zakupów',
     'Dopisz, czego brakuje albo co przyniesiesz. Przypisz się do rzeczy,
     którą się zajmiesz.', 'Lista jest pusta - dodaj pierwszą rzecz!')`
     oraz wiersz `event_shopping_settings` z domyślnymi opcjami; potem
     `select insert_default_event_sections(e.id) from events e`
     (`on conflict do nothing` dopisze tylko brakujące).
   - `save_event_section` - bez zmian: dla `shopping` wołane bez `p_items`
     (wpisy należą do gości, nie do konfiguracji).
   - **`event_shopping_settings`** (`event_id` pk → events on delete
     cascade, cztery kolumny boolean jak wyżej). RLS: select dla
     `is_event_member`; zapis tylko przez RPC
     `save_event_shopping_settings(p_event_id, p_settings jsonb)` -
     `require_platform_admin()`.
   - `get_event_page` - **bez zmian** (równolegle zmienia ją branch
     z linkami zaproszeń); ustawienia czyta frontend bezpośrednio z
     `event_shopping_settings` (RLS: członkowie), razem z wpisami.
   - **`event_shopping_items`**:
     ```
     id          uuid pk default gen_random_uuid()
     event_id    uuid not null → events on delete cascade
     created_by  uuid → profiles(id) on delete set null, default auth.uid()
     assigned_to uuid null → profiles(id) on delete set null
     name        text not null, 1-120
     note        text null, 1-500
     quantity    integer null, 1-999
     unit        text null, 1-20
     created_at  timestamptz not null default now()
     updated_at  timestamptz not null default now()
     index (event_id, created_at)
     ```
     `enable row level security`, `revoke all ... from anon, authenticated`.
   - Granty kolumn (klient nie zmieni `event_id`, `created_by`,
     `assigned_to`, dat):
     ```sql
     grant select on event_shopping_items to authenticated;
     grant insert (event_id, name, note, quantity, unit) on ... to authenticated;
     grant update (name, note, quantity, unit) on ... to authenticated;
     grant delete on ... to authenticated;
     ```
   - `public.shopping_list_open(p_event_id)` (security definer, stable):
     sekcja `shopping` widoczna **albo** `has_event_role(ADMIN, EDITOR)`.
     Gość nie doda wpisu do ukrytej sekcji wywołaniem API.
   - Polityki:
     - select: `is_event_member(event_id)`;
     - insert: `created_by = (select auth.uid()) and is_event_member(event_id)
       and shopping_list_open(event_id)`;
     - update / delete: `(created_by = (select auth.uid()) and
       shopping_list_open(event_id)) or has_event_role(event_id,
       array['ADMIN','EDITOR'])`.
   - Przypisanie przez RPC (security definer - gość zmienia cudzy wiersz,
     ale tylko w tym jednym zakresie):
     - `add_shopping_item(p_event_id, p_name, p_note, p_quantity, p_unit,
       p_assign_to_me boolean)` - wstawia wpis i od razu przypisanie
       w jednej transakcji (zwykły insert przez tabelę nie ustawi
       `assigned_to`). Te same warunki co polityka insert + `allow_assign`,
       gdy `p_assign_to_me`.
     - `assign_shopping_item(p_item_id)` - członek, lista otwarta,
       `allow_assign`, `assigned_to is null` → `auth.uid()`; zajęty →
       `PT409` „Ktoś już się tym zajął”.
     - `unassign_shopping_item(p_item_id)` - `assigned_to = auth.uid()`
       albo `has_event_role(ADMIN, EDITOR)` → `null`.
   - Trigger `before insert or update`: `clean_text` na `name`, `note`,
     `unit` (pusty → null, puste `name` → błąd z checka), `unit` bez
     `quantity` → null, `updated_at = now()`.
   - Trigger `before insert` z limitami (ochrona przed spamem, `PT400`):
     max **500** wpisów w wydarzeniu, max **50** wpisów jednego autora
     w wydarzeniu.
3. **`npm run db:types`** - regeneracja `src/types/database.ts`.

### B2. Testy bazy - `supabase/tests/11_shopping_list.test.sql`

Wzorzec aktorów jak w `09_seating.test.sql`: A (super admin), D (ADMIN
wydarzenia), E (EDITOR), G1/G2 (goście), O (obcy), anon.

- nowe i istniejące wydarzenia mają sekcję `shopping` (`is_visible = false`)
  i wiersz opcji z wartościami domyślnymi;
- sekcja ukryta: G1 nie dodaje, E/D/A dodają; widoczna: G1 dodaje;
- G1 nie wstawi wpisu z `created_by = G2` ani do cudzego wydarzenia;
- G1 edytuje / usuwa swój wpis, nie edytuje / usuwa wpisu G2 (0 wierszy);
- E, D, A edytują i usuwają każdy wpis;
- G1 nie zmieni `created_by`, `assigned_to`, `event_id` bezpośrednio
  (brak grantu kolumny);
- przypisanie: G1 bierze wolny wpis G2; G2 nie przejmie go (`PT409`);
  G2 nie wypisze G1; G1 się wypisuje; E wypisuje G1;
  `add_shopping_item(..., true)` przypisuje autora;
- `allow_assign = false` → assign / add z przypisaniem odmawiają;
  wypisanie nadal działa (żeby nikt nie został „uwięziony”);
- opcje: tylko super admin zapisuje; członkowie czytają; obcy nie;
- O nie widzi wpisów; anon nie ma dostępu;
- limity 500 / 50; walidacja długości i `quantity` 1-999;
- usunięcie profilu → `created_by` / `assigned_to = null`.

`npm run db:test`.

### B3. Frontend

1. **Typy i konfiguracja sekcji**
   - `src/types/eventPage.ts`: w `EVENT_SECTIONS` po `seating`:
     `{ key: 'shopping', label: 'Lista zakupów', navLabel: 'Lista', configurable: true }`;
     `EventPage.shoppingSettings`; limity w `EVENT_PAGE_LIMITS`
     (`shoppingName: 120`, `shoppingNote: 500`, `shoppingUnit: 20`,
     `shoppingQuantityMax: 999`).
   - `src/lib/eventPageApi.ts`: mapowanie `shopping_settings`,
     `saveShoppingSettings()`.
   - `src/config/navigation.ts`: `SECTION_IDS.shopping`, pozycja w
     `SECTION_NAV_ITEMS`.
   - `src/types/shopping.ts`: `ShoppingItem`
     (`author` i `assignee`: `{ id, displayName } | null`).
2. **Panel super admina**
   - `src/components/eventConfig/ShoppingListEditor.tsx` (nowy):
     `TextSectionEditor`-owe pola nagłówka i tekstu pustej listy + blok
     „Pola i informacje na liście” z czterema przełącznikami (`Switch`),
     zapis razem z tekstami.
   - `SectionsSettings.tsx`: `case 'shopping'` → `ShoppingListEditor`;
     `isEmpty` → `false` (pusta lista też jest pokazywana, bo goście ją
     wypełniają).
3. **API** - `src/lib/shoppingApi.ts`:
   - `fetchShoppingItems(eventId)` -
     `select('id, name, note, quantity, unit, created_at, updated_at, created_by, assigned_to, author:profiles!created_by(id, display_name), assignee:profiles!assigned_to(id, display_name)')`,
     sort `created_at asc`;
   - `addShoppingItem(..., assignToMe)` (RPC), `updateShoppingItem(id,
     patch, expectedUpdatedAt)`, `deleteShoppingItem`, `assignShoppingItem`,
     `unassignShoppingItem`.
   - Konflikt edycji (autor i organizator naraz): update z
     `.eq('updated_at', expectedUpdatedAt)`; 0 wierszy → „Wpis zmienił się
     w międzyczasie” i odświeżenie listy (por. TODO pkt 3). Konflikt
     przypisania (`PT409`) → komunikat i odświeżenie.
4. **Hook** - `src/hooks/useShoppingList.ts` (wzór: `useSeatingPlan`):
   ładuje tylko, gdy sekcja jest włączona; `failed` / `retry`;
   aktualizacja lokalnego stanu po każdym zapisie; odświeżenie przy
   powrocie do karty (`visibilitychange`) zamiast realtime.
5. **Sekcja na stronie** - `src/components/sections/ShoppingListSection.tsx`:
   - `SectionHeading` (eyebrow / title / description);
   - formularz: nazwa (wymagana); opis, ilość + jednostka - tylko gdy
     włączone; „Przypisz do mnie” - gdy `allow_assign`; na telefonie pola
     jedno pod drugim;
   - karta wpisu: **nazwa** (+ „2 kg”), opis, „dodał(a): Nick”
     (`show_author`), stan przypisania (`allow_assign`):
     - wolne → „Nikt się jeszcze nie zajął” + przycisk „Biorę to”;
     - moje → „Zajmujesz się tym” + „Rezygnuję”;
     - cudze → „Zajmuje się: Nick” (+ „Zwolnij” dla organizatorów);
   - Edytuj / Usuń tylko przy
     `canEdit = item.created_by === userId || role ∈ {ADMIN, EDITOR} || isSuperAdmin`;
     edycja w `sheet` na telefonie; usuwanie przez `confirm-dialog`;
   - filtr / licznik: „12 rzeczy · 4 bez osoby” i przełącznik
     „Tylko wolne” (gdy `allow_assign`);
   - pusta lista → `content_body`.
6. **`EventGalleryScreen.tsx`** - `visibleSections`: `shopping: true`;
   render sekcji w kolejności `EVENT_SECTIONS`; nowe propsy `userId`,
   `role`, `isSuperAdmin` z `App.tsx`.
7. `npm run lint`, `npm run build`, testy ręczne: gość / drugi gość
   z tym samym nickiem / EDITOR / super admin, sekcja ukryta i widoczna,
   każda opcja wł. / wył., dwie karty przeglądarki biorące ten sam wpis,
   telefon (375 px).

### B4. Zakładka „Lista zakupów” w Zarządzaniu

Panel organizatora wydarzenia (`/management`, obok Goście / Plan sali /
Wydatki). Dostęp: ADMIN i EDITOR (`canEditGuests`) - oboje i tak mogą
edytować wszystkie wpisy, więc bez trybu podglądu. Bez zmian w bazie -
korzysta z tych samych polityk i RPC co sekcja na stronie.

1. **Routing** - `ROUTES.managementShopping = '/management/shopping'`,
   trasa w `App.tsx` jak `managementSeating`.
2. **Kafelek** w `ManagementScreen.tsx` (ikona `ShoppingBasket`, opis
   „Co trzeba kupić lub przynieść i kto się tym zajmuje.”), podsumowanie
   z `src/hooks/useShoppingSummary.ts`: „12 rzeczy · 4 bez osoby” /
   „Lista jest pusta” / „Sekcja ukryta na stronie” (gdy `is_visible = false`).
3. **`src/components/screens/ShoppingManagementScreen.tsx`** +
   **`src/components/shopping/ShoppingManagementPanel.tsx`** (wzór:
   `GuestsManagementScreen` / `GuestManagementPanel`):
   - pasek narzędzi: wyszukiwarka po nazwie / opisie, filtr „Wszystkie /
     Bez osoby / Z osobą”, filtr po osobie (lista przypisanych),
     „Dodaj rzecz”;
   - desktop: tabela (nazwa, ilość, opis, dodał(a), zajmuje się, dodano),
     sortowanie po kolumnach; telefon: karty (jak `GuestCardList`);
   - akcje na wierszu: edycja (sheet), usunięcie (`confirm-dialog`),
     „Zwolnij” przypisanie; organizator może też przypisać **siebie**
     (te same zasady co na stronie - nie przypisuje innych);
   - zawsze pokazuje wszystkie pola, niezależnie od opcji listy (opcje
     dotyczą strony gości) - przy wyłączonych polach mała adnotacja
     „ukryte na stronie”;
   - zestawienie „Kto czym się zajmuje”: osoby z liczbą i nazwami rzeczy
     (zwijana lista), przydatne do przypomnień;
   - działa także przy ukrytej sekcji (`shopping_list_open` przepuszcza
     ADMIN / EDITOR) - organizator może przygotować listę przed
     włączeniem sekcji; baner „Sekcja jest ukryta - goście jej nie widzą”.
4. Wspólny kod ze stroną gościa: `shoppingApi.ts`, `useShoppingList.ts`,
   formularz wpisu (`src/components/shopping/ShoppingItemForm.tsx`) -
   jeden komponent dla sekcji i panelu.
5. Eksport do XLSX - poza zakresem, razem z pkt 5 z TODO (eksport danych).
6. Testy ręczne: ADMIN, EDITOR, gość (brak kafelka i trasy), sekcja ukryta
   i widoczna, telefon (375 px).

### B5. Wdrożenie

- Migracje na bazę `em` (`supabase db push` na projekt em), potem deploy
  Workera `wedding-page-em` (`--env em`). Na `wp` bez zmian.
- Sekcja jest domyślnie ukryta, więc wdrożenie niczego gościom nie zmienia,
  dopóki super admin jej nie włączy.

---

## Do decyzji

1. Domyślne opcje: opis wł., ilość wył., autor wł., przypisywanie wł. - ok?
2. Limit 50 wpisów na osobę - ok? (na wydarzenie: 500)
