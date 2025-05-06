import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './client-side',
  build: {
    outDir: '../public/dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'client-main.js'),
        admin: path.resolve(__dirname, 'admin/admin-main.js'),
      },
      output: {
        manualChunks: undefined, // Let Vite handle code splitting
      },
    },
    emptyOutDir: true,
  },
  server: {
    open: '/index.html',
  },
});
