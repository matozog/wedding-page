# Zadania / uwagi

## Do zrobienia

- [ ] **1. Nawigacja super admina do edycji wydarzeń**
  - W panelu zarządzania super admin powinien mieć bezpośrednie przejście do edycji wydarzenia (teraz musi przeklikiwać się przez 2 strony).
  - Będąc w wydarzeniu, powinien mieć opcję przejścia do konfiguracji tego wydarzenia bez wracania przez zakładkę „Wydarzenia”.

- [ ] **2. Własne kolory w edycji motywu (theme)**
  - Obecnie można wybrać tylko predefiniowane zestawy kolorów, a chcę też móc ustawić własne.
  - Do ustalenia:
    - które kolory można edytować (np. główny, akcent, tło, tekst);
    - czy predefiniowany zestaw ma być punktem wyjścia, który potem się modyfikuje;
    - podgląd na żywo i przycisk „przywróć domyślne”;
    - ostrzeżenie przy zbyt słabym kontraście tekstu z tłem.

- [ ] **3. Współbieżność – kilka osób edytuje w tym samym czasie (do analizy)**
  - Przemyśleć, co się dzieje, gdy kilka osób (np. para młoda, organizator, admin) pracuje na tych samych danych naraz.
  - Priorytet: **tabela gości i edycja gości**. Tu ryzyko konfliktów jest największe.
  - Plan stołów: niekoniecznie potrzebne, najpierw ocenić, czy warto.
  - Do ustalenia:
    - skala problemu: jak często ktoś faktycznie edytuje równolegle;
    - zachowanie przy konflikcie: ostatni zapis wygrywa, ostrzeżenie „dane zmieniły się w międzyczasie” (optimistic locking, np. kolumna `version`/`updated_at`) czy blokada rekordu na czas edycji;
    - poziom szczegółowości: cały gość, pojedyncze pole czy cała lista;
    - czy pokazywać zmiany innych na żywo (odświeżanie, polling, WebSocket/Durable Objects), czy wystarczy wykryć konflikt przy zapisie;
    - informacja, kto aktualnie edytuje / kto ostatnio zmienił rekord;
    - masowe operacje (import, usuwanie wielu gości) a równoległe edycje pojedynczych rekordów.

- [ ] **4. Przejście z panelu wydarzeń na publiczną stronę wydarzenia**
  - Teraz przycisk „Wejdź” na liście wydarzeń otwiera panel admina wydarzenia, a nie stronę, którą widzą goście.
  - Dodać osobny przycisk, np. „Zobacz stronę” / „Otwórz stronę”, prowadzący prosto na publiczną stronę wydarzenia.
  - Powiązane z pkt 1 (nawigacja w panelu). Warto zaprojektować razem.
  - Do ustalenia:
    - czy otwierać w nowej karcie;
    - czy przycisk ma być też w panelu admina samego wydarzenia (szybki podgląd strony);
    - czy nazwę „Wejdź” zmienić na bardziej jednoznaczną (np. „Zarządzaj”);
    - co pokazać, gdy strona nie jest jeszcze opublikowana albo jest chroniona hasłem.

- [ ] **5. Eksport danych / kopie zapasowe**
  - **Goście → XLSX**: na pewno potrzebne. Daje też wygodną pracę w Excelu, druk i przekazanie listy np. sali.
  - **Plan stołów → JSON**: kopia zapasowa „na wszelki wypadek”.
  - Do ustalenia:
    - które kolumny w XLSX (imię, nazwisko, status RSVP, stolik, dieta, osoba towarzysząca, uwagi itd.) i czy eksportować widok po filtrach, czy zawsze całość;
    - czy JSON planu stołów ma dać się z powrotem **zaimportować** (przywrócenie backupu), bo inaczej to tylko podgląd;
    - format JSON: wersja schematu, ID wydarzenia, data eksportu, żeby import był bezpieczny;
    - może pełny backup wydarzenia w jednym pliku (goście + stoły + ustawienia)?
    - kto może eksportować (super admin, admin wydarzenia, para młoda) – to dane osobowe gości (RODO);
    - opcjonalnie automatyczny backup cykliczny, poza ręcznym eksportem.

- [ ] **6. Podgląd strony podczas edycji sekcji**
  - Przy edycji sekcji strony wydarzenia brakuje podglądu efektu. Teraz trzeba przełączać się na stronę i sprawdzać.
  - Pomysł: podgląd w oknie modalnym (duże okno, żeby sekcja się zmieściła), otwierany przyciskiem „Podgląd” przy edytowanej sekcji.
  - Powiązane z pkt 2 (własne kolory motywu, tam też przyda się podgląd na żywo) i pkt 4 (przejście na publiczną stronę).
  - Do ustalenia:
    - podgląd tylko edytowanej sekcji czy całej strony z przewinięciem do niej;
    - czy pokazywać **niezapisane** zmiany (podgląd przed zapisem), czy dopiero po zapisie;
    - przełącznik widoku telefon / desktop (goście wejdą głównie z telefonów);
    - alternatywa: podgląd obok formularza (podział ekranu) zamiast modala na szerokich ekranach.

## Zrobione

