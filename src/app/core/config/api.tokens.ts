import { InjectionToken } from '@angular/core';
import { environment, type AppEnvironment } from '../../../environments/environment';

interface RuntimeEnv {
  apiBaseUrl?: string;
  environment?: string;
}

type EnvName = AppEnvironment['name'];

const ENV_NAMES: readonly EnvName[] = ['dev', 'canary', 'production'];

const runtimeEnv = (): RuntimeEnv => (globalThis as { __env?: RuntimeEnv }).__env ?? {};

const envNameOf = (value: string | undefined): EnvName | undefined =>
  ENV_NAMES.find((name) => name === (value ?? '').trim().toLowerCase());

export const envLabelKey = (name: EnvName): string => `env.${name}`;

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
