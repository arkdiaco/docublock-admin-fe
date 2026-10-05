export type EnvName = 'dev' | 'canary' | 'production';

export const ENV_NAMES: readonly EnvName[] = ['dev', 'canary', 'production'];

export const envNameOf = (value: string | undefined): EnvName | undefined =>
  ENV_NAMES.find((name) => name === (value ?? '').trim().toLowerCase());

export const envLabelKey = (name: EnvName): string => `env.${name}`;
