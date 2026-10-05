import type { AppEnvironment } from './environment.types';

export type { AppEnvironment } from './environment.types';

export const environment: AppEnvironment = {
  production: false,
  name: 'dev',
  apiBaseUrl: 'http://localhost:3810/api/core',
  defaultLang: 'es',
};
