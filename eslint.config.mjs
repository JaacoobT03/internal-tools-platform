// @ts-check
import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// AGENTS.md rule 6 / ADR 0007: apps may import platform, never another app;
// platform never imports apps. Proven by tools/eslint-boundaries.test.cjs.
const boundaryRules = {
  files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  plugins: { boundaries },
  settings: {
    'import/resolver': {
      typescript: {
        project: ['client/tsconfig.json', 'server/tsconfig.json'],
        noWarnOnMultipleProjects: true,
      },
      node: true,
    },
    'boundaries/legacy-templates': false,
    'boundaries/dependency-nodes': [
      'import',
      'export',
      'dynamic-import',
      'require',
    ],
    'boundaries/elements': [
      { type: 'server-app', pattern: 'server/src/apps/*', capture: ['app'] },
      { type: 'server-platform', pattern: 'server/src/platform' },
      { type: 'client-app', pattern: 'client/app/*', capture: ['app'] },
      { type: 'client-platform', pattern: 'client/lib' },
    ],
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        default: 'allow',
        policies: [
          ...['server-app', 'client-app'].flatMap((type) => [
            {
              from: { element: { type } },
              disallow: { to: { element: { type } } },
            },
            {
              from: { element: { type } },
              allow: {
                to: {
                  element: {
                    type,
                    captured: { app: '{{ from.element.captured.app }}' },
                  },
                },
              },
            },
          ]),
          {
            from: { element: { type: 'server-platform' } },
            disallow: { to: { element: { type: 'server-app' } } },
          },
          {
            from: { element: { type: 'client-platform' } },
            disallow: { to: { element: { type: 'client-app' } } },
          },
        ],
      },
    ],
  },
};

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    'server/src/platform/prisma/generated/**',
    'tools/fixtures/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['server/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['client/**/*.{js,jsx,ts,tsx,mjs}'],
    extends: [nextVitals, nextTs],
    settings: { next: { rootDir: 'client' } },
  },
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  boundaryRules,
  prettier,
]);
