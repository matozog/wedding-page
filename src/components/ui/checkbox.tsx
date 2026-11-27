import { Check } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

type CheckboxProps = Omit<React.ComponentProps<'input'>, 'type'>

// Pole wyboru we własnym stylu - natywny checkbox z accent-color miga
// na ciemnych motywach (przeglądarka przelicza kolor przy hover/focus).
// Zostaje zwykłym <input type="checkbox">, więc działa z register()
// z react-hook-form i z <label>.
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => (
  <span className={cn('relative inline-flex size-4 shrink-0', className)}>
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'peer size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background',
        'checked:border-primary checked:bg-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
      {...props}
    />
    <Check
      aria-hidden="true"
      strokeWidth={3}
      className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
    />
  </span>
))
Checkbox.displayName = 'Checkbox'

export { Checkbox }
