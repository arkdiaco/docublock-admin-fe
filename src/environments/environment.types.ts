export interface AppEnvironment {
  production: boolean;
  name: 'dev' | 'canary' | 'production';
  apiBaseUrl: string;
  defaultLang: 'es' | 'en';
}
