export const ROUTES = {
  home: '/',
  management: '/management',
  managementGuests: '/management/guests',
  managementExpenses: '/management/expenses',
  managementSeating: '/management/seating',
  // Panel super admina - wszystkie wydarzenia. Dostępny także bez wybranego
  // wydarzenia (wejście bezpośrednio pod ten adres).
  events: '/events',
  // Konfiguracja jednego wydarzenia (super admin).
  eventConfig: '/events/:eventId',
} as const

export const eventConfigPath = (eventId: string) => `/events/${eventId}`
