import { envLabelKey, envNameOf } from './environment';

describe('nombre de entorno', () => {
  it('normaliza espacios y mayúsculas y rechaza lo que no es un entorno conocido', () => {
    expect(envNameOf(' Canary ')).toBe('canary');
    expect(envNameOf('PRODUCTION')).toBe('production');
    expect(envNameOf('staging')).toBeUndefined();
    expect(envNameOf(undefined)).toBeUndefined();
  });

  it('la llave del rótulo sale del nombre', () => {
    expect(envLabelKey('dev')).toBe('env.dev');
  });
});
