import {
  identicaFiltersOf,
  identicaQueryParamsOf,
  identicaRangeIssue,
  identicaRequestOf,
} from './identica-report-filters';

describe('Periodo del reporte de Identica', () => {
  it('sin nada en la URL toma los últimos 30 días', () => {
    const filtros = identicaFiltersOf({});
    expect(filtros).toEqual({ period: '30-dias', from: null, to: null });
    expect(identicaRequestOf(filtros, '2026-11-26', 'America/Bogota')).toEqual({
      from: '2026-10-28',
      to: '2026-11-26',
      tz: 'America/Bogota',
    });
  });

  it('lee el periodo de la URL y descarta lo que no sirve', () => {
    expect(identicaFiltersOf({ periodo: 'mes-pasado' })).toEqual({
      period: 'mes-pasado',
      from: null,
      to: null,
    });
    expect(identicaFiltersOf({ periodo: 'siempre' }).period).toBe('30-dias');
    expect(identicaFiltersOf({ desde: '2026-11-01', hasta: 'ayer' })).toEqual({
      period: 'personalizado',
      from: '2026-11-01',
      to: null,
    });
  });

  it('el personalizado pide solo las fechas que hay', () => {
    const filtros = { period: 'personalizado' as const, from: '2026-11-01', to: null };
    expect(identicaRequestOf(filtros, '2026-11-26', 'America/Bogota')).toEqual({
      from: '2026-11-01',
      tz: 'America/Bogota',
    });
  });

  it('escribe en la URL solo lo que no es el valor por defecto', () => {
    expect(identicaQueryParamsOf({ period: '30-dias', from: null, to: null })).toEqual({
      periodo: null,
      desde: null,
      hasta: null,
    });
    expect(
      identicaQueryParamsOf({ period: 'personalizado', from: '2026-11-01', to: '2026-11-05' }),
    ).toEqual({ periodo: 'personalizado', desde: '2026-11-01', hasta: '2026-11-05' });
  });

  it('avisa cuando el periodo está al revés', () => {
    expect(
      identicaRangeIssue(
        { period: 'personalizado', from: '2026-11-05', to: '2026-11-01' },
        '2026-11-26',
      ),
    ).toBe('RANGO_INVERTIDO');
    expect(
      identicaRangeIssue({ period: 'este-mes', from: null, to: null }, '2026-11-26'),
    ).toBeNull();
  });
});
