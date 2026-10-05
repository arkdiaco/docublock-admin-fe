import { TestBed } from '@angular/core/testing';
import { NavMenuComponent, type NavEntry } from './nav-menu.component';

const ENTRADAS: NavEntry[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', shortcut: '⌘1', active: true },
  { key: 'documents', label: 'Documentos', icon: 'documents', count: 53 },
  { key: 'blocks', label: 'Blocks', icon: 'blocks', count: 9 },
  { key: 'processes', label: 'Procesos', icon: 'processes' },
];

const montar = (entries = ENTRADAS) => {
  const fixture = TestBed.createComponent(NavMenuComponent);
  fixture.componentRef.setInput('entries', entries);
  fixture.detectChanges();
  return fixture;
};

describe('NavMenuComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NavMenuComponent] }).compileComponents();
  });

  it('pinta una entrada por cada sección', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelectorAll('.navmenu__item').length).toBe(4);
  });

  it('la entrada activa se marca para que la hoja de estilos la reconozca', () => {
    const items = montar().componentInstance.items();
    expect(items[0].styleClass).toBe('db-active');
    expect(items[1].styleClass).toBeUndefined();
  });

  it('el contador solo sale donde hay número', () => {
    const host = montar().nativeElement as HTMLElement;
    const contadores = [...host.querySelectorAll('.navmenu__count')].map((c) => c.textContent?.trim());
    expect(contadores).toEqual(['53', '9']);
  });

  it('un contador de cero se pinta, porque cero es información', () => {
    const host = montar([{ key: 'x', label: 'Vacío', icon: 'documents', count: 0 }])
      .nativeElement as HTMLElement;
    expect(host.querySelector('.navmenu__count')?.textContent?.trim()).toBe('0');
  });

  it('el atajo desplaza al contador: nunca salen los dos', () => {
    const host = montar([
      { key: 'x', label: 'Ambos', icon: 'documents', count: 7, shortcut: '⌘1' },
    ]).nativeElement as HTMLElement;
    expect(host.querySelectorAll('.navmenu__shortcut').length).toBe(1);
    expect(host.querySelectorAll('.navmenu__count').length).toBe(0);
  });

  it('avisa con la clave de la sección al pulsarla', () => {
    const fixture = montar();
    const pulsadas: string[] = [];
    fixture.componentInstance.entryClick.subscribe((k) => pulsadas.push(k));
    fixture.componentInstance.items()[2].command?.({} as never);
    expect(pulsadas).toEqual(['blocks']);
  });

  it('cada entrada dibuja su icono de trazo, uno por fila', () => {
    const host = montar().nativeElement as HTMLElement;
    const iconos = [...host.querySelectorAll('.navmenu__icon svg')];
    expect(iconos.length).toBe(host.querySelectorAll('.navmenu__item').length);
    expect(iconos.every((s) => s.getAttribute('stroke') === 'currentColor')).toBe(true);
    expect(iconos.every((s) => s.getAttribute('width') === '18')).toBe(true);
  });

  it('el icono de Dashboard trae su cuadro de acento relleno', () => {
    const host = montar().nativeElement as HTMLElement;
    const primero = host.querySelector('.navmenu__icon svg');
    expect(primero?.querySelectorAll('rect[fill]').length).toBe(1);
  });
});
