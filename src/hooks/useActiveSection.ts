import { useEffect, useState } from 'react'

// Sekcja, która przecina pas w górnej części ekranu (tuż pod nagłówkiem).
// Przy kilku naraz wygrywa pierwsza w kolejności ids.
const OBSERVER_ROOT_MARGIN = '-25% 0px -65% 0px'

export function useActiveSection(ids: readonly string[]) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return
    }

    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id)
          } else {
            visible.delete(entry.target.id)
          }
        }

        const first = ids.find((id) => visible.has(id))
        // Między sekcjami (np. stopka) zostaje ostatnia aktywna.
        if (first) {
          setActiveId(first)
        }
      },
      { rootMargin: OBSERVER_ROOT_MARGIN }
    )

    for (const id of ids) {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    }

    return () => observer.disconnect()
  }, [ids])

  return activeId
}
