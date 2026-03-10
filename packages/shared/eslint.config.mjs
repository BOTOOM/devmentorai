const ignoredPaths = [
  'node_modules/**',
  'coverage/**',
  '**/*.d.ts',
  '**/*.js',
  '**/*.cjs',
  '**/*.mjs',
  '**/*.map',
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
        files: ['**/*.ts'],
        languageOptions: {
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
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
