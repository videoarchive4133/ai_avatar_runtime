import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5181, watch: { usePolling: false, ignored: ['**/*'] } },
  preview: { port: 5182 },
});
