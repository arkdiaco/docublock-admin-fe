import { durationKeyOf, durationPartsOf, toneOfChange } from './analytics-format';

describe('Analítica: formato de cambios y duraciones', () => {
  it('subir es bueno salvo cuando menos es mejor, como el tiempo', () => {
    expect(toneOfChange(118, 100)).toEqual({ percent: 18, tone: 'up' });
    expect(toneOfChange(80, 100)).toEqual({ percent: -20, tone: 'down' });
    expect(toneOfChange(5, 5)).toEqual({ percent: 0, tone: 'flat' });
    expect(toneOfChange(118, 100, true)).toEqual({ percent: 18, tone: 'down' });
    expect(toneOfChange(80, 100, true)).toEqual({ percent: -20, tone: 'up' });
    expect(toneOfChange(4, 0)).toBeNull();
  });

  it('parte el tiempo en días, horas y minutos', () => {
    expect(durationPartsOf(0)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(durationPartsOf(45 * 60_000)).toEqual({ days: 0, hours: 0, minutes: 45 });
    expect(durationPartsOf((3 * 60 + 20) * 60_000)).toEqual({ days: 0, hours: 3, minutes: 20 });
    expect(durationPartsOf(((2 * 24 + 4) * 60 + 10) * 60_000)).toEqual({
      days: 2,
      hours: 4,
      minutes: 10,
    });
  });

  it('elige el texto según la unidad más grande', () => {
    expect(durationKeyOf({ days: 2, hours: 4, minutes: 0 })).toBe('pan.duration.daysHours');
    expect(durationKeyOf({ days: 0, hours: 3, minutes: 20 })).toBe('pan.duration.hoursMinutes');
    expect(durationKeyOf({ days: 0, hours: 0, minutes: 5 })).toBe('pan.duration.minutes');
  });
});
