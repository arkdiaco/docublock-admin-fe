import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';

const SEP = '›';

const flatten = (obj: unknown, prefix = ''): string[] => {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}${SEP}${key}` : key),
  );
};

describe('catálogos de traducción', () => {
  const clavesEs = flatten(es).sort();
  const clavesEn = flatten(en).sort();

  it('español e inglés tienen exactamente las mismas llaves', () => {
    expect(clavesEn).toEqual(clavesEs);
  });

  it('ninguna traducción está vacía', () => {
    const vacias = [
      ...flatten(es).filter((k) => !valorDe(es, k)),
      ...flatten(en).filter((k) => !valorDe(en, k)),
    ];
    expect(vacias).toEqual([]);
  });

  it('ninguna traducción es la llave sin traducir', () => {
    const crudas = flatten(es).filter((k) => valorDe(es, k) === k.split(SEP).join('.'));
    expect(crudas).toEqual([]);
  });
});

function valorDe(obj: unknown, path: string): string {
  return path.split(SEP).reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj) as string;
}
