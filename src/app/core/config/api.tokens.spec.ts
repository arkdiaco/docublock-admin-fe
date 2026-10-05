import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { API_BASE_URL, APP_ENV, envLabelKey } from './api.tokens';

interface Runtime {
  __env?: { apiBaseUrl?: string; environment?: string };
}

describe('tokens de entorno', () => {
  afterEach(() => {
    delete (globalThis as Runtime).__env;
  });

  it('sin env.js manda lo compilado', () => {
    expect(TestBed.inject(APP_ENV).name).toBe(environment.name);
    expect(TestBed.inject(API_BASE_URL)).toBe(environment.apiBaseUrl);
  });

  it('la variable del contenedor cambia el entorno y la URL del core', () => {
    (globalThis as Runtime).__env = { apiBaseUrl: 'https://canary.core.test/api/core', environment: ' Canary ' };
    const env = TestBed.inject(APP_ENV);
    expect(env.name).toBe('canary');
    expect(env.apiBaseUrl).toBe('https://canary.core.test/api/core');
    expect(envLabelKey(env.name)).toBe('env.canary');
  });

  it('un entorno desconocido o vacío no rompe: cae en el compilado', () => {
    (globalThis as Runtime).__env = { environment: 'staging' };
    expect(TestBed.inject(APP_ENV).name).toBe(environment.name);
  });
});
