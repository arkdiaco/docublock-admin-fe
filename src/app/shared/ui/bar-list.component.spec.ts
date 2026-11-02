import { TestBed } from '@angular/core/testing';
import { BarListComponent, type BarListItem } from './bar-list.component';

const montar = (items: BarListItem[]): HTMLElement => {
  const fixture = TestBed.createComponent(BarListComponent);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('label', 'Por mes');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

const anchos = (host: HTMLElement): string[] =>
  [...host.querySelectorAll<HTMLElement>('.bars__fill')].map((fill) => fill.style.width);

describe('BarListComponent', () => {
  it('mide cada barra contra la mayor y muestra el valor en texto', () => {
    const host = montar([
      { key: 'a', label: 'Enero', value: 200, valueText: '$ 200' },
      { key: 'b', label: 'Febrero', value: 100, valueText: '$ 100', note: '3 transacciones' },
    ]);
    expect(anchos(host)).toEqual(['100%', '50%']);
    expect(host.textContent).toContain('$ 100');
    expect(host.textContent).toContain('3 transacciones');
    expect(host.querySelector('ul')?.getAttribute('aria-label')).toBe('Por mes');
  });

  it('un valor diminuto se sigue viendo y todo en cero no divide por cero', () => {
    expect(
      anchos(
        montar([
          { key: 'a', label: 'A', value: 100000, valueText: 'x' },
          { key: 'b', label: 'B', value: 1, valueText: 'y' },
        ]),
      ),
    ).toEqual(['100%', '2%']);
    expect(anchos(montar([{ key: 'a', label: 'A', value: 0, valueText: '0' }]))).toEqual(['0%']);
  });
});
