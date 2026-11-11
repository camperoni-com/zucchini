import js from '@eslint/js'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import reactHooks from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'simple-import-sort': simpleImportSort },
    rules: {
      ...reactHooks.configs.recommended.rules,
      curly: 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // The commands print their reports to the terminal.
    files: ['src/cli/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  prettierRecommended
)
