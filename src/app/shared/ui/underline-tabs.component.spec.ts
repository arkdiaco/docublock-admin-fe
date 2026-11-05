import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UnderlineTabsComponent } from './underline-tabs.component';

describe('UnderlineTabsComponent', () => {
  const montar = (tabs: unknown[], active: string) => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(UnderlineTabsComponent);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.componentRef.setInput('active', active);
    fixture.componentRef.setInput('label', 'Estado');
    fixture.detectChanges();
    return fixture;
  };

  it('las pestañas de filtro son botones con conteo y la marcada se subraya; el punto va con su color', () => {
    const fixture = montar(
      [
        { key: 'all', label: 'Todas', count: 1 },
        { key: 'suspended', label: 'Suspendidas', count: 1, dot: 'warn' },
      ],
      'all',
    );
    const host = fixture.nativeElement as HTMLElement;
    const tabs = host.querySelectorAll<HTMLButtonElement>('button.tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].classList).toContain('tab--on');
    expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
    expect(tabs[1].querySelector('.tab__dot--warn')).not.toBeNull();
    expect(tabs[1].querySelector('.tab__count--warn')?.textContent?.trim()).toBe('1');

    let elegido = '';
    fixture.componentInstance.picked.subscribe((key) => (elegido = key));
    tabs[1].click();
    expect(elegido).toBe('suspended');
  });

  it('si la pestaña marcada queda fuera de la franja, la franja se corre hasta mostrarla', () => {
    const caja = (left: number, right: number) => () => ({ left, right }) as DOMRect;
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.classList.contains('tabs')) return caja(0, 300)();
      if (this.classList.contains('tab--on')) return caja(380, 450)();
      return caja(0, 0)();
    };
    try {
      const fixture = montar(
        [
          { key: 'alerts', label: 'Avisos', link: '/a' },
          { key: 'texts', label: 'Textos', link: '/b' },
        ],
        'texts',
      );
      const franja = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.tabs');
      expect(franja?.scrollLeft).toBe(150);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  it('con enlace se pintan como rutas y marcan la página actual', () => {
    const fixture = montar(
      [
        { key: 'summary', label: 'Resumen general', link: '/reseller/reportes' },
        { key: 'risk', label: 'Riesgo de abandono', link: '/reseller/reportes/riesgo-abandono', count: 1, dot: 'danger' },
      ],
      'risk',
    );
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.tab');
    expect(links[1].getAttribute('href')).toBe('/reseller/reportes/riesgo-abandono');
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[1].querySelector('.tab__dot--danger')).not.toBeNull();
  });
});
