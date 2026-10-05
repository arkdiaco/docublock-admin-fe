// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['dba', 'db', 'app'], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['dba', 'db', 'app'], style: 'kebab-case' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Usa DialogService o NotificationService.' },
        { name: 'confirm', message: 'Usa DialogService.confirm().' },
        { name: 'prompt', message: 'Usa DialogService.prompt().' },
      ],
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
