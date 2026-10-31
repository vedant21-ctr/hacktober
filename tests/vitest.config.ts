import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, '..'),
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['server/**/*.ts', 'shared/**/*.ts'],
      exclude: ['**/*.d.ts', '**/dist/**', '**/fixtures/**', '**/*.test.ts', 'server/index.ts'],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 75,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@decisionvault/shared': path.resolve(__dirname, '../shared'),
      '@decisionvault/server': path.resolve(__dirname, '../server'),
    },
  },
});
