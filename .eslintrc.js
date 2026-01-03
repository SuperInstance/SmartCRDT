module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'prefer-const': 'error',
  },
  overrides: [
    {
      // Allow console statements in CLI packages
      files: [
        'packages/cli/**/*.ts',
        'packages/cli/**/*.js',
        'packages/*/cli/**/*.ts',
        'packages/*/cli/**/*.js',
        'tools/**/cli/**/*.ts',
        'tools/**/cli/**/*.js',
      ],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // Stricter rules for test files
      files: [
        '**/*.test.ts',
        '**/*.test.js',
        '**/*.spec.ts',
        '**/*.spec.js',
        'packages/**/*.test.ts',
        'packages/**/*.spec.ts',
      ],
      env: {
        node: true,
        es2022: true,
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    '*.config.ts',
    '.eslintrc.js',
  ],
};
