#!/usr/bin/env node
// Lokalne środowisko jedną komendą: Docker -> Supabase -> .env.development.local -> Vite.
//
//   npm run dev:local          uruchamia (lub wykorzystuje działający) stack i Vite
//   npm run dev:local:reset    dodatkowo resetuje lokalną bazę (migracje + seed)
//
// Supabase zostaje uruchomiony po zamknięciu Vite. Zatrzymanie: npm run db:stop.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = join(root, '.env.development.local')
const reset = process.argv.includes('--reset')

const log = (msg) => console.log(`\x1b[36m[dev-local]\x1b[0m ${msg}`)
const fail = (msg) => {
  console.error(`\x1b[31m[dev-local]\x1b[0m ${msg}`)
  process.exit(1)
}

// Komendy idą przez shell (na Windows binarki z node_modules/.bin to pliki .cmd),
// więc przekazujemy je jako jeden napis. Argumenty są stałymi z tego pliku.
const run = (command, { capture = false } = {}) =>
  spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

const supabase = (args, opts) => run(`npx --no-install supabase ${args}`, opts)

// 1. Docker
log('Sprawdzam Dockera...')
if (run('docker info', { capture: true }).status !== 0) {
  fail('Docker nie działa. Uruchom Docker Desktop i spróbuj ponownie.')
}

// 2. Supabase
if (supabase('status', { capture: true }).status === 0) {
  log('Supabase już działa.')
} else {
  log('Uruchamiam Supabase (pierwszy start pobiera obrazy Dockera)...')
  if (supabase('start').status !== 0) {
    fail('Nie udało się uruchomić Supabase.')
  }
}

// 3. Reset bazy (opcjonalnie)
if (reset) {
  log('Resetuję lokalną bazę (migracje + seed)...')
  if (supabase('db reset').status !== 0) {
    fail('Reset bazy nie powiódł się.')
  }
}

// 4. Plik env dla Vite - tylko publiczna konfiguracja.
const status = supabase('status -o env', { capture: true })
if (status.status !== 0) {
  fail(`Nie udało się odczytać statusu Supabase:\n${status.stderr}`)
}
const statusEnv = Object.fromEntries(
  status.stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value])
)
const apiUrl = statusEnv.API_URL
const publicKey = statusEnv.PUBLISHABLE_KEY || statusEnv.ANON_KEY
if (!apiUrl || !publicKey) {
  fail('W statusie Supabase brakuje API_URL lub klucza publicznego.')
}

if (!existsSync(envFile)) {
  writeFileSync(
    envFile,
    [
      '# Wygenerowane przez scripts/dev-local.mjs - lokalny stack Supabase.',
      `VITE_SUPABASE_URL=${apiUrl}`,
      `VITE_SUPABASE_PUBLISHABLE_KEY=${publicKey}`,
      '',
    ].join('\n')
  )
  log('Utworzono .env.development.local.')
} else {
  const current = readFileSync(envFile, 'utf8').match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim()
  if (current !== apiUrl) {
    console.warn(
      `\x1b[33m[dev-local]\x1b[0m Uwaga: VITE_SUPABASE_URL w .env.development.local to "${current ?? '(brak)'}",\n` +
        `             a lokalny Supabase działa pod ${apiUrl}. Aplikacja może łączyć się z inną bazą.`
    )
  }
}

log(`Studio: ${statusEnv.STUDIO_URL ?? 'http://127.0.0.1:54323'}  |  kod testowy: TEST123`)

// 5. Vite
log('Uruchamiam Vite...')
const vite = spawn('npx --no-install vite', { cwd: root, shell: true, stdio: 'inherit' })
vite.on('exit', (code) => {
  log('Vite zakończony. Supabase nadal działa - zatrzymasz go przez: npm run db:stop')
  process.exit(code ?? 0)
})
