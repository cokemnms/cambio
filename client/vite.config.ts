import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// host: true binds to 0.0.0.0 so you can open the dev server from your phone
// on the same Wi-Fi (http://<your-lan-ip>:5173).
// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: { host: true, port: 5173 },
})
