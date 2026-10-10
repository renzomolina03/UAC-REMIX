import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function judicialDevApiPlugin(): Plugin {
  return {
    name: 'judicial-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
          return;
        }

        const dataDir = path.join(process.cwd(), 'data');
        const storeFilePath = path.join(dataDir, 'boletas_store.json');

        if (url === '/api/boletas') {
          if (req.method === 'GET') {
            let boletas = [];
            if (fs.existsSync(storeFilePath)) {
              try {
                boletas = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8'));
              } catch {}
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ boletas }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (Array.isArray(parsed.boletas)) {
                  if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                  }
                  fs.writeFileSync(storeFilePath, JSON.stringify(parsed.boletas, null, 2), 'utf-8');
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, count: parsed.boletas.length }));
                  return;
                }
              } catch {}
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'invalid payload' }));
            });
            return;
          }
        }

        if (url.startsWith('/api/rendicion/')) {
          const rawCode = url.replace('/api/rendicion/', '').split('?')[0];
          const cleanCode = decodeURIComponent(rawCode).trim().toUpperCase();
          let boletas: any[] = [];
          if (fs.existsSync(storeFilePath)) {
            try {
              boletas = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8'));
            } catch {}
          }
          const courtBoletas = boletas.filter((b: any) => {
            const bTri = (b?.tribunal || '').trim().toUpperCase();
            if (bTri === cleanCode) return true;
            const bNorm = bTri.replace(/[^A-Z0-9]/g, '');
            const tNorm = cleanCode.replace(/[^A-Z0-9]/g, '');
            return bNorm.length > 0 && bNorm === tNorm;
          });
          const devueltas = courtBoletas.filter((b: any) => b.devueltaAlTribunal).length;
          const total = courtBoletas.length;
          const efectividad = total > 0 ? Math.round((devueltas / total) * 100) : 0;

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            tribunalCodigo: cleanCode,
            total,
            practicadas: devueltas,
            efectividad,
            boletas: courtBoletas,
          }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      judicialDevApiPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Sistema de Control de Boletas Judiciales y Acuses',
          short_name: 'Boletas TSJ',
          description: 'Sistema oficial y autónomo para control de boletas judiciales, diligencias de alguacilazgo y acuses.',
          theme_color: '#1e3a8a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'any',
          categories: ['productivity', 'business', 'government'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-dom/client'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'workbox-window'],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
