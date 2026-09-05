export const weddingContent = {
  defaultTitle: 'Nasze wesele',
  couple: {
    names: 'Wiktoria & Piotr',
    date: '1 września 2015',
    venue: 'Schodki w II LO',
    story:
      'Tutaj może jaka historia jak się poznaliście',
  },
  locations: {
    ceremony: {
      name: 'Kościół Podwyższenia Krzyża Świętego',
      address: 'ul. Jana Pawła II 5, 22-170 Rejowiec Fabryczny',
    },
    reception: {
      name: 'Dom Weselny Regent',
      address: 'ul. Lubelska 72, 22-170 Pawłów',
    },
  },
  // Plan dnia - zamockowane godziny/pozycje, podmieńcie na docelowy przebieg.
  schedule: {
    note: 'Orientacyjny przebieg dnia - godziny mogą jeszcze się nieznacznie zmienić.',
    items: [
      { time: '15:00', title: 'Ceremonia ślubna', description: 'Kościół Podwyższenia Krzyża Świętego' },
      { time: '16:00', title: 'Przyjazd do sali', description: 'Powitanie chlebem i solą' },
      { time: '16:30', title: 'Toast powitalny', description: 'Lampka szampana i pierwsze gratulacje' },
      { time: '17:30', title: 'Obiad - I danie', description: '' },
      { time: '19:00', title: 'Przekąski', description: 'Zimna płyta' },
      { time: '20:00', title: 'Pierwszy taniec', description: 'Para Młoda otwiera parkiet' },
      { time: '20:30', title: 'Obiad - II danie', description: '' },
      { time: '21:30', title: 'Tort weselny', description: '' },
      { time: '22:30', title: 'Przekąski nocne', description: '' },
    ],
  },
  // Rzut sali: pozycje (x, y) oraz rozmiary (w, h) podane w procentach
  // względem kontenera planu (0-100), więc skalują się na każdym ekranie.
  // Układ odtworzony na podstawie realnego planu sali w Domu Weselnym Regent -
  // rząd 7 prostokątnych stołów, stół pary młodej nad nimi, parkiet i wejście poniżej.
  // "landmarks" to elementy tła (parkiet, wejście) - tylko kontekst wizualny, nieklikalne.
  seating: {
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
        guests: ['Wiktoria', 'Piotr'],
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
  },
  contact: {
    email: 'piotr.ozog@example.com',
    phone: '+48 887 887 162',
    note: 'W razie pytań dotyczących dojazdu, noclegu lub programu dnia — śmiało piszcie lub dzwońcie.',
  },
  footer: {
    message: 'Dziękujemy, że jesteście z nami w tym wyjątkowym dniu.',
    year: 2026,
  },
} as const
