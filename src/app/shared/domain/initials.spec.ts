import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('toma las dos primeras palabras con más de dos letras', () => {
    expect(initialsOf('Bruno de la Torre')).toBe('BT');
    expect(initialsOf('Aliados Digitales SAS')).toBe('AD');
  });

  it('con palabras cortas usa las dos primeras letras', () => {
    expect(initialsOf('a b')).toBe('A ');
    expect(initialsOf('Al')).toBe('AL');
  });
});
