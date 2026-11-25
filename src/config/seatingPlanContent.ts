// Plan sali - na razie stałe dane (konfiguracja planu sali to osobne
// zadanie). Sekcja jest domyślnie ukryta w nowych wydarzeniach.
// Rzut sali: pozycje (x, y) oraz rozmiary (w, h) podane w procentach
// względem kontenera planu (0-100), więc skalują się na każdym ekranie.
// Układ odtworzony na podstawie realnego planu sali w Domu Weselnym Regent -
// rząd 7 prostokątnych stołów, stół pary młodej nad nimi, parkiet i wejście poniżej.
// "landmarks" to elementy tła (parkiet, wejście) - tylko kontekst wizualny, nieklikalne.
export const seatingPlanContent = {
  note: 'Znajdźcie swój stolik na planie sali - kliknijcie stół, aby zobaczyć pełną listę gości.',
  roomAspectRatio: '2000 / 1060',
  landmarks: [
    { id: 'parkiet', label: 'Parkiet', x: 6, y: 65, w: 88, h: 24 },
    { id: 'wejscie', label: 'Wejście', x: 45, y: 92, w: 10, h: 4 },
  ],
  tables: [
    {
      id: 'para-mloda',
      label: 'Para Młoda',
      shape: 'rect' as const,
      x: 34,
      y: 5,
      w: 19,
      h: 12,
      guests: ['Eunika', 'Mateusz'],
    },
    // Rząd wyrównany do jednakowej szerokości/rozstawu - oryginalny plan był
    // odręcznym szkicem, nie precyzyjnym pomiarem sali.
    { id: 't1', label: 'Stół 1', shape: 'rect' as const, x: 6, y: 20, w: 10, h: 42, guests: [] },
    { id: 't2', label: 'Stół 2', shape: 'rect' as const, x: 19, y: 20, w: 10, h: 42, guests: [] },
    {
      id: 't3',
      label: 'Stół Rodziców Panny Młodej',
      shape: 'rect' as const,
      x: 32,
      y: 20,
      w: 10,
      h: 42,
      guests: [],
    },
    { id: 't4', label: 'Stół 3', shape: 'rect' as const, x: 45, y: 20, w: 10, h: 42, guests: [] },
    {
      id: 't5',
      label: 'Stół Rodziców Pana Młodego',
      shape: 'rect' as const,
      x: 58,
      y: 20,
      w: 10,
      h: 42,
      guests: [],
    },
    { id: 't6', label: 'Stół 4', shape: 'rect' as const, x: 71, y: 20, w: 10, h: 42, guests: [] },
    { id: 't7', label: 'Stół 5', shape: 'rect' as const, x: 84, y: 20, w: 10, h: 42, guests: [] },
  ],
} as const
