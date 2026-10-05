import { TestBed } from '@angular/core/testing';
import { SessionStorage } from './session.storage';

describe('SessionStorage', () => {
  let storage: SessionStorage;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    storage = TestBed.inject(SessionStorage);
  });

  it('devuelve null cuando no hay nada guardado', () => {
    expect(storage.read()).toBeNull();
  });

  it('guarda y recupera la sesión', () => {
    storage.write({ accessToken: 'a', refreshToken: 'r' });
    expect(storage.read()).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('devuelve null si el contenido está corrupto, sin reventar', () => {
    localStorage.setItem('dba.session', 'esto no es json');
    expect(storage.read()).toBeNull();
  });

  it('devuelve null si falta el token de acceso', () => {
    localStorage.setItem('dba.session', JSON.stringify({ refreshToken: 'r' }));
    expect(storage.read()).toBeNull();
  });

  it('borra la sesión', () => {
    storage.write({ accessToken: 'a', refreshToken: 'r' });
    storage.clear();
    expect(storage.read()).toBeNull();
  });
});
