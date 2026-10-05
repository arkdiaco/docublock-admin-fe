import { ORG_STATES, orgStateOf, quotaToneOf } from './org-state';

describe('estado de organización', () => {
  it('cada estado tiene su forma de punto, porque los exportes a soporte salen en blanco y negro', () => {
    expect(ORG_STATES.map((s) => [s.key, s.shape])).toEqual([
      ['active', 'circle'],
      ['trial', 'ring'],
      ['warning', 'square'],
      ['suspended', 'square'],
      ['closed', 'dash'],
    ]);
  });

  it('un estado desconocido cae en «de baja», nunca en «activa»', () => {
    expect(orgStateOf('active').labelKey).toBe('org.state.active');
    expect(orgStateOf('lo-que-sea').key).toBe('closed');
  });

  it('la cuota es morada mientras cuenta, ámbar al 90 % y roja al 100 %; sin límite nunca avisa', () => {
    expect(quotaToneOf(48, 60)).toBe('ok');
    expect(quotaToneOf(54, 60)).toBe('warn');
    expect(quotaToneOf(60, 60)).toBe('over');
    expect(quotaToneOf(61, 60)).toBe('over');
    expect(quotaToneOf(1000, null)).toBe('ok');
    expect(quotaToneOf(5, 0)).toBe('ok');
  });
});
