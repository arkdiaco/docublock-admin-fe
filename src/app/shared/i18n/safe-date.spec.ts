import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { safeDate } from './safe-date';

registerLocaleData(localeEs);

describe('safeDate', () => {
  it('formatea como formatDate cuando la fecha se puede leer', () => {
    expect(safeDate('2026-03-05T15:04:00.000Z', 'd/MM/y HH:mm', 'es', 'UTC')).toBe(
      '5/03/2026 15:04',
    );
    expect(safeDate(new Date(Date.UTC(2026, 0, 2)), 'd/MM/y', 'es', 'UTC')).toBe('2/01/2026');
    expect(safeDate(Date.UTC(2026, 0, 2), 'd/MM/y', 'es', 'UTC')).toBe('2/01/2026');
  });

  it('una fecha que falta o no se puede leer queda en raya', () => {
    for (const value of [null, undefined, '', 'Invalid date', 'no es fecha', Number.NaN]) {
      expect(safeDate(value, 'd/MM/y', 'es')).toBe('—');
    }
  });

  it('acepta otro texto de reemplazo', () => {
    expect(safeDate('Invalid date', 'yyyy-MM-dd', 'es', undefined, '')).toBe('');
  });
});
