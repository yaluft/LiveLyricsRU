import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.tsbuild/**',
      '**/node_modules/**',
      'packages/web/.tsbuild/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    // The reason this project uses ESLint rather than Biome.
    //
    // Destructuring props in a Solid component severs reactivity *silently* —
    // no error, no warning, the component simply stops updating. It is also
    // exactly what idiomatic React code does on line one, so a team porting
    // from React writes the bug by habit. Biome has no Solid reactivity lints,
    // so this rule is the deciding factor.
    files: ['packages/web/**/*.{ts,tsx}'],
    ...solid,
    rules: {
      ...solid.rules,
      'solid/reactivity': 'error',
      'solid/no-destructure': 'error',
    },
  },
);
