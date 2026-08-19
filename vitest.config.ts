import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/pub-leads/**', '**/temp_clone_publeads/**', '**/pub-dev-loop/**'],
    alias: {
      'cloudflare:workers': path.resolve(__dirname, './tests/mocks/cloudflare-workers.ts'),
    },
  },
});
