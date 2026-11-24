// Polska odmiana po liczebniku: 1 osoba, 2 osoby, 5 osób, 22 osoby, 12 osób.
export const pluralPl = (count: number, one: string, few: string, many: string) => {
  if (count === 1) return one

  const lastDigit = count % 10
  const lastTwo = count % 100

  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}

export const countPl = (count: number, one: string, few: string, many: string) =>
  `${count} ${pluralPl(count, one, few, many)}`
