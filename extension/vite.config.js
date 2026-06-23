import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'

import baseManifest from './manifest.json'
import { PRODUCTION_BACKEND_ORIGIN } from './production.config.js'

// manifest.json giữ domain backend production làm nguồn chính thức (dùng khi
// publish). Ở chế độ dev (`npm run dev` / `vite build --mode development`),
// đổi host_permissions sang localhost để test với backend chạy local mà
// không phải sửa tay manifest.json mỗi lần.
function resolveManifest(mode) {
  if (mode === 'production') return baseManifest
  return {
    ...baseManifest,
    host_permissions: baseManifest.host_permissions.map((origin) =>
      origin === `${PRODUCTION_BACKEND_ORIGIN}/*` ? 'http://localhost:3000/*' : origin
    ),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest: resolveManifest(mode) })],
  build: {
    rollupOptions: {
      input: {
        detail: resolve(__dirname, 'detail.html'),
      },
    },
  },
}))
