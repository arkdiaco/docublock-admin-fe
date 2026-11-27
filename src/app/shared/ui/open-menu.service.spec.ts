import { TestBed } from '@angular/core/testing';
import { OpenMenuService } from './open-menu.service';

describe('OpenMenuService', () => {
  const servicio = () => TestBed.inject(OpenMenuService);

  it('arranca sin menú abierto', () => {
    expect(servicio().current()).toBeNull();
  });

  it('el último que se abre queda como el abierto', () => {
    const menus = servicio();
    const a = Symbol('a');
    const b = Symbol('b');
    menus.claim(a);
    expect(menus.current()).toBe(a);
    menus.claim(b);
    expect(menus.current()).toBe(b);
  });

  it('cerrar un menú que ya no es el abierto no toca al abierto', () => {
    const menus = servicio();
    const a = Symbol('a');
    const b = Symbol('b');
    menus.claim(a);
    menus.claim(b);
    menus.release(a);
    expect(menus.current()).toBe(b);
    menus.release(b);
    expect(menus.current()).toBeNull();
  });
});
