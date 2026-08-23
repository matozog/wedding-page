type ErrorMessageProps = {
  message: string | null
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) {
    return null
  }

  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
      {message}
    </p>
  )
}
