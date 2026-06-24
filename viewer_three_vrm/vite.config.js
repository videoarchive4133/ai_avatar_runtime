import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const actionJsonPath = path.resolve(dirname, '../actions/action.json');
const assetsVrmDir = path.resolve(dirname, '../assets');

// sample VRM files served from assets dir (avoids dist copy)
const SAMPLES = {
  '/samples/AliciaSolid.vrm':    path.join(assetsVrmDir, 'vrm/AliciaSolid_vrm-0.51.vrm'),
  '/samples/AvatarSample_A.vrm': path.join(assetsVrmDir, 'vrm/hair/AvatarSample_A.vrm'),
  '/samples/AvatarSample_B.vrm': path.join(assetsVrmDir, 'vrm/hair/AvatarSample_B.vrm'),
  '/samples/AvatarSample_C.vrm': path.join(assetsVrmDir, 'vrm/hair/AvatarSample_C.vrm'),
  '/samples/vroid_base.vrm':     path.join(assetsVrmDir, 'vrm/base_body/vroid_base.vrm'),
  '/samples/vroid_male.vrm':     path.join(assetsVrmDir, 'vrm/base_body/vroid_male.vrm'),
};

function appMiddleware() {
  return {
    name: 'app-middleware',
    configureServer(server) {
      server.middlewares.use(serveActionJson);
      server.middlewares.use(serveSamples);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveActionJson);
      server.middlewares.use(serveSamples);
    },
  };
}

async function serveActionJson(req, res, next) {
  if (req.url !== '/action.json') return next();
  try {
    const body = await readFile(actionJsonPath, 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  } catch (error) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'action.json not found', message: error.message }));
  }
}

async function serveSamples(req, res, next) {
  const url = req.url?.split('?')[0];
  const filePath = SAMPLES[url];
  if (!filePath) return next();
  try {
    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Length', data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

export default defineConfig({
  plugins: [appMiddleware()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    watch: { usePolling: false, ignored: ['**/*'] },
    fs: {
      allow: [dirname, path.resolve(dirname, '../assets')],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    copyPublicDir: false,
  },
});
