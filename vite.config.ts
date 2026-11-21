import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Aplikacja działa od korzenia domeny (em.ozogowie.pl/, lokalnie localhost:5173/).
// Wersja pod ozogowie.pl/wiktoria-i-piotr/ żyje na branchu "wp".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
