import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    // Phase 1 module federation remote — uncomment when exposing this MFE:
    // federation({
    //   name: 'parties',
    //   filename: 'remoteEntry.js',
    //   exposes: { './App': './src/App.tsx' },
    //   shared: ['react', 'react-dom', 'react-redux'],
    // }),
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
});
