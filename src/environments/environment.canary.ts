import type { AppEnvironment } from './environment.types';

export type { AppEnvironment } from './environment.types';

export const environment: AppEnvironment = {
  production: true,
  name: 'canary',
  apiBaseUrl: 'https://canary.core-be.docublock.co/api/core',
  defaultLang: 'es',
};
