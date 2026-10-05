import { InjectionToken } from '@angular/core';
import { environment, type AppEnvironment } from '../../../environments/environment';

interface RuntimeEnv {
  apiBaseUrl?: string;
}

const runtimeEnv = (): RuntimeEnv => (globalThis as { __env?: RuntimeEnv }).__env ?? {};

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => runtimeEnv().apiBaseUrl || environment.apiBaseUrl,
});

export const APP_ENV = new InjectionToken<AppEnvironment>('APP_ENV', {
  providedIn: 'root',
  factory: () => ({
    ...environment,
    apiBaseUrl: runtimeEnv().apiBaseUrl || environment.apiBaseUrl,
  }),
});
