import { CountPipe, PesosPipe } from './money.pipe';

describe('pipes de dinero y conteo', () => {
  it('formatean pesos y cantidades en es-CO y toleran valores ausentes', () => {
    expect(new PesosPipe().transform(2_124_150)).toBe('$ 2.124.150');
    expect(new PesosPipe().transform(null)).toBe('$ 0');
    expect(new CountPipe().transform(1240)).toBe('1.240');
    expect(new CountPipe().transform(undefined)).toBe('0');
  });
});
