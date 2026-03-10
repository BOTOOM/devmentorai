const ignoredPaths = [
  '.output/**',
  '.wxt/**',
  'dist/**',
  'node_modules/**',
  'coverage/**',
  '**/*.d.ts',
  '**/*.js',
  '**/*.cjs',
  '**/*.mjs',
];

let tseslint;

try {
  tseslint = (await import('typescript-eslint')).default;
} catch {
  tseslint = null;
}

const eslintConfig = tseslint
  ? [
      {
        ignores: ignoredPaths,
      },
      ...tseslint.configs.recommended,
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: {
              jsx: true,
            },
          },
        },
        rules: {
          'no-console': 'off',
        },
      },
    ]
  : [
      {
        ignores: [...ignoredPaths, '**/*'],
      },
    ];

export default eslintConfig;
