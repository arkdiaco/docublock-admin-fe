import { activeParamOf, codeStateOf, isWhole } from './promotions-view';

describe('promotions-view', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');

  it('el estado del código prioriza inactivo, luego vencido y luego agotado', () => {
    const base = { active: true, remaining: 3 };
    expect(codeStateOf(base, now)).toBe('available');
    expect(codeStateOf({ ...base, remaining: 0 }, now)).toBe('exhausted');
    expect(codeStateOf({ ...base, remaining: 0, expiresAt: '2026-11-01T00:00:00.000Z' }, now)).toBe(
      'expired',
    );
    expect(
      codeStateOf({ ...base, active: false, expiresAt: '2026-11-01T00:00:00.000Z' }, now),
    ).toBe('inactive');
  });

  it('solo acepta enteros dentro del rango', () => {
    expect(isWhole('20', 1, 100)).toBe(true);
    expect(isWhole('0', 1, 100)).toBe(false);
    expect(isWhole('101', 1, 100)).toBe(false);
    expect(isWhole('1.5', 1, 100)).toBe(false);
    expect(isWhole('', 1, 100)).toBe(false);
  });

  it('la vista se traduce al parámetro active', () => {
    expect(activeParamOf('all')).toBeUndefined();
    expect(activeParamOf('active')).toBe(true);
    expect(activeParamOf('inactive')).toBe(false);
  });
});
