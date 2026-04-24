import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        /** Native C++ add-on: load from `node_modules`, not from the Rollup bundle. */
        external: ['better-sqlite3'],
      },
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
  },
})
