import {
  IDENTICA_QUERIES_LIMIT,
  identicaCategoriesFor,
  identicaExportRequestOf,
  identicaListFiltersOf,
  identicaListParamsOf,
  identicaQueriesRequestOf,
  isListFiltered,
  withListChange,
} from './identica-query-filters';

const periodo = { from: '2026-10-28', to: '2026-11-26', tz: 'America/Bogota' };

describe('Filtros de la lista de consultas a Identica', () => {
  it('sin nada en la URL trae todo lo que no salió bien, en la primera página', () => {
    const filtros = identicaListFiltersOf({});
    expect(filtros).toEqual({ group: null, category: null, service: null, page: 1 });
    expect(isListFiltered(filtros)).toBe(false);
    expect(identicaQueriesRequestOf(filtros, periodo)).toEqual({
      ...periodo,
      page: 1,
      limit: IDENTICA_QUERIES_LIMIT,
    });
  });

  it('lee grupo, clasificación, servicio y página, y descarta lo que no sirve', () => {
    expect(
      identicaListFiltersOf({
        grupo: 'identica',
        clasificacion: 'identica_server_error',
        servicio: 'ani',
        pagina: '3',
      }),
    ).toEqual({ group: 'identica', category: 'identica_server_error', service: 'ani', page: 3 });
    expect(
      identicaListFiltersOf({ grupo: 'todos', clasificacion: 'otra', servicio: 'x', pagina: '-2' }),
    ).toEqual({ group: null, category: null, service: null, page: 1 });
  });

  it('descarta la clasificación que no es del grupo elegido', () => {
    expect(identicaListFiltersOf({ grupo: 'review', clasificacion: 'approved' })).toEqual({
      group: 'review',
      category: null,
      service: null,
      page: 1,
    });
  });

  it('la clasificación sola también sirve, aunque sea de «Sin error»', () => {
    const filtros = identicaListFiltersOf({ clasificacion: 'negative' });
    expect(isListFiltered(filtros)).toBe(true);
    expect(identicaQueriesRequestOf(filtros, periodo)).toEqual({
      ...periodo,
      category: 'negative',
      page: 1,
      limit: IDENTICA_QUERIES_LIMIT,
    });
  });

  it('el CSV lleva el periodo y los filtros, pero no la página', () => {
    const filtros = identicaListFiltersOf({ grupo: 'identica', servicio: 'ani', pagina: '4' });
    expect(identicaExportRequestOf(filtros, periodo)).toEqual({
      ...periodo,
      group: 'identica',
      service: 'ani',
    });
  });

  it('escribe en la URL solo lo que no es el valor por defecto', () => {
    expect(identicaListParamsOf({ group: null, category: null, service: null, page: 1 })).toEqual({
      grupo: null,
      clasificacion: null,
      servicio: null,
      pagina: null,
    });
    expect(
      identicaListParamsOf({ group: 'docublock', category: null, service: 'auth', page: 2 }),
    ).toEqual({ grupo: 'docublock', clasificacion: null, servicio: 'auth', pagina: '2' });
  });

  it('al cambiar un filtro vuelve a la primera página y suelta la clasificación de otro grupo', () => {
    const actual = {
      group: null,
      category: 'approved' as const,
      service: 'ani' as const,
      page: 4,
    };
    expect(withListChange(actual, { group: 'identica' })).toEqual({
      group: 'identica',
      category: null,
      service: 'ani',
      page: 1,
    });
    expect(withListChange(actual, { page: 5 })).toEqual({ ...actual, page: 5 });
  });

  it('ofrece las clasificaciones del grupo elegido, o todas sin grupo', () => {
    expect(identicaCategoriesFor('identica')).toEqual([
      'identica_no_response',
      'identica_server_error',
      'identica_internal_error',
    ]);
    expect(identicaCategoriesFor('docublock')).toEqual([
      'request_rejected',
      'docublock_internal_error',
    ]);
    expect(identicaCategoriesFor(null)).toHaveLength(10);
  });
});
