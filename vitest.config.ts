import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'node_modules/**',
        'dist/**',
        'pkg/**',
        'target/**',
        'bench*.js',
        'scripts/**',
        '*.config.ts',
      ],
      all: true,
      lines: 90,
      functions: 90,
      branches: 70,
      statements: 90,
    },
  },
});
