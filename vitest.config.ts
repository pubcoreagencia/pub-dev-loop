import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/projects/**', '**/pub-servers/**', '**/pub-leads/**', '**/temp_*/**', '**/scratch/**', '**/pub-dev-loop/**'],
    alias: {
      'cloudflare:workers': path.resolve(__dirname, './tests/mocks/cloudflare-workers.ts'),
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
