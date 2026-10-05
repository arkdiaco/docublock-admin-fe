import { InjectionToken } from '@angular/core';
import { environment, type AppEnvironment } from '../../../environments/environment';
import { envNameOf } from '../../shared/domain/environment';

interface RuntimeEnv {
  apiBaseUrl?: string;
  environment?: string;
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
    name: envNameOf(runtimeEnv().environment) ?? environment.name,
    apiBaseUrl: runtimeEnv().apiBaseUrl || environment.apiBaseUrl,
  }),
});
