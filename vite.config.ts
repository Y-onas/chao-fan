import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { createApi } from './server/api.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chaofan-api',
      configureServer(server) {
        const api = createApi({ dataDir: process.env.DATA_DIR ?? path.resolve('data'), adminToken: process.env.ADMIN_TOKEN ?? 'dev-admin' });
        server.middlewares.use((req, res, next) => {
          api(req, res).then((handled) => !handled && next(), next);
        });
      },
    },
  ],
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
