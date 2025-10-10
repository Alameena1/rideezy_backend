import js from '@eslint/js';
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2020
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      // Basic rules
      'no-unused-vars': 'off', 
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'prefer-const': 'off',
      
      // More flexible private member naming
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: ['classProperty', 'parameterProperty', 'method'],
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'allow' 
        }
      ]
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.js',
      'kerala-latest.osm*',
      'logs/**',
      '.env'
    ],
  },
];