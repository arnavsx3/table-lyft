import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'jsdom', environmentOptions: { jsdom: { pretendToBeVisual: true } },
    include: ['tests/**/*.test.ts'], restoreMocks: true },
});
