import { textLength } from './text-length';

describe('Largo de un texto como lo mide el core', () => {
  it('un emoji o un símbolo con variante cuenta como un carácter', () => {
    expect(textLength('abc')).toBe(3);
    expect(textLength('👍👍')).toBe(2);
    expect(textLength('❤️a')).toBe(2);
    expect(textLength('')).toBe(0);
  });
});
