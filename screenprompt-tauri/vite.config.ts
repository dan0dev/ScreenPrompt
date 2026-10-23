import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Official releases are built by GitHub Actions; any other build (tauri dev, a
    // build on your own PC) shows a DEV tag in the title bar, so it can't be
    // mistaken for a release
    __LOCAL_BUILD__: JSON.stringify(process.env.GITHUB_ACTIONS !== 'true'),
  },
})
