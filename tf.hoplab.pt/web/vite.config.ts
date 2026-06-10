import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: '/speechcraft/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@tf/types': resolve(__dirname, '../packages/types/index.ts'),
    },
  },
})
