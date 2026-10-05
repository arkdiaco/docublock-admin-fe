import { buildIdOf, isStaleChunkError } from './build-id';

describe('build-id', () => {
  it('saca la huella del bundle principal del index publicado; en desarrollo no hay huella', () => {
    expect(buildIdOf('<script src="env.js"></script><script src="main-TGC37CP4.js" type="module"></script>')).toBe('TGC37CP4');
    expect(buildIdOf('<script src="main.js" type="module"></script>')).toBeNull();
  });

  it('reconoce el chunk que ya no existe en Chrome, Safari y Firefox, y nada más', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://app/chunk-AAAA1111.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module: https://app/chunk-AAAA1111.js'))).toBe(true);
    expect(isStaleChunkError(new Error('Http failure response for /api: 500'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
