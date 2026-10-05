import { calendarLocale } from './calendar-locale';

describe('calendar-locale', () => {
  it('arma los nombres del calendario en español con mayúscula inicial y sin abreviatura con punto', () => {
    const locale = calendarLocale('es', { today: 'Hoy', clear: 'Limpiar' });
    expect(locale.monthNames[0]).toBe('Enero');
    expect(locale.monthNames[7]).toBe('Agosto');
    expect(locale.dayNames[0]).toBe('Domingo');
    expect(locale.monthNamesShort[0]).toBe('Ene');
    expect(locale.dayNamesShort.every((day) => !day.endsWith('.'))).toBe(true);
    expect(locale.dateFormat).toBe('dd/mm/yy');
    expect(locale.today).toBe('Hoy');
  });

  it('cambia de idioma sin listas escritas a mano', () => {
    expect(calendarLocale('en', { today: 'Today', clear: 'Clear' }).monthNames[0]).toBe('January');
  });
});
