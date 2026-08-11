import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    // Phase 1 module federation host — uncomment when wiring remotes:
    // federation({
    //   name: 'shell',
    //   remotes: {
    //     parties: 'http://localhost:5174/assets/remoteEntry.js',
    //   },
    //   shared: ['react', 'react-dom', 'react-redux'],
    // }),
    // Requires: npm i -D @originjs/vite-plugin-federation
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
