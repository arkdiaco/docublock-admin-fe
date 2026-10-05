import { toParams } from './query-params';

describe('toParams', () => {
  it('omite vacíos, serializa fechas en ISO y repite las listas', () => {
    const params = toParams({
      search: '',
      page: 2,
      order: undefined,
      nada: null,
      from: new Date('2026-09-11T00:00:00Z'),
      progress: [1, 2],
      flag: false,
    });
    expect(params.toString()).toBe('page=2&from=2026-09-11T00:00:00.000Z&progress=1&progress=2&flag=false');
  });
});
