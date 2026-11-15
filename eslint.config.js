import js from '@eslint/js';
import globals from 'globals';

/** Shared rules: the recommended set, plus a few that keep the code tidy. */
const rules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-control-regex': 'off', // validate.js strips control characters on purpose
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-eval': 'error',
  'no-implied-eval': 'error',
};

export default [
  { ignores: ['node_modules/'] },
  { files: ['src/**/*.js', 'test/**/*.js', 'scripts/**/*.mjs', 'eslint.config.js'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node }, rules },
  { files: ['public/js/**/*.js'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.browser }, rules },
  { files: ['public/sw.js'], languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: globals.serviceworker }, rules },
];
