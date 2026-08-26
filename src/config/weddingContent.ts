export const weddingContent = {
  defaultTitle: 'Nasze wesele',
  couple: {
    names: 'Wiktoria & Piotr',
    date: '12 września 2026',
    venue: 'Dom weselny Regent, Pawłów',
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
  news: [
    {
      id: '1',
      date: '1 czerwca 2026',
      title: 'Potwierdzenie obecności',
      content:
        'Prosimy o potwierdzenie obecności do 1 czerwca. Możecie to zrobić telefonicznie lub mailowo — dane kontaktowe znajdziecie poniżej.',
    },
    {
      id: '2',
      date: '10 czerwca 2026',
      title: 'Plan dnia weselnego',
      content:
        'Ceremonia rozpocznie się o 15:00, a popołudniowe przyjęcie o 16:30. Przygotowaliśmy też strefę zdjęć — wrzucajcie swoje kadry do galerii!',
    },
    {
      id: '3',
      date: '15 czerwca 2026',
      title: 'Dzielcie się wspomnieniami',
      content:
        'Wasze zdjęcia z wesela to dla nas najpiękniejszy prezent. Użyjcie przycisku „Dodaj zdjęcia" w nagłówku strony, aby podzielić się chwilami z tego wyjątkowego dnia.',
    },
  ],
  contact: {
    email: 'piotr.ozog@example.com',
    phone: '+48 123 456 789',
    note: 'W razie pytań dotyczących dojazdu, noclegu lub programu dnia — śmiało piszcie lub dzwońcie.',
  },
  footer: {
    message: 'Dziękujemy, że jesteście z nami w tym wyjątkowym dniu.',
    year: 2026,
  },
} as const
