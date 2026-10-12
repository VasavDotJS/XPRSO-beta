import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/server': path.resolve(__dirname, './src/server'),
      '@/ui': path.resolve(__dirname, './src/ui'),
    },
  },
});
