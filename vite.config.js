import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/spiritfinder/',  // This should match your repository name
  resolve: {
    alias: {
      'three': resolve(__dirname, 'node_modules/three')
    }
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});