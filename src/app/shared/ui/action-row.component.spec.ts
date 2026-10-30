import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActionRowComponent } from './action-row.component';

describe('ActionRowComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ providers: [provideRouter([])] }).compileComponents();
  });

  const render = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(ActionRowComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('pinta referencia, sujeto, texto y botón en una fila enlazada con su consulta', () => {
    const host = render({
      tone: 'bad',
      reference: '900123456',
      subject: 'Puerto de Valparaíso',
      text: 'cupo de documentos agotado',
      cta: 'Revisar',
      link: ['/organizaciones', 'o1'],
      query: { tab: 'quotas' },
    });
    const anchor = host.querySelector('a.row') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/organizaciones/o1?tab=quotas');
    expect(host.querySelector('.row__ref')?.textContent).toBe('900123456');
    expect(host.querySelector('.row__subject')?.textContent).toBe('Puerto de Valparaíso');
    expect(host.querySelector('.row__text')?.textContent).toContain('· cupo de documentos agotado');
    expect(host.querySelector('.row__cta')?.textContent).toBe('Revisar');
    expect(host.querySelector('.row__dot')?.className).toContain('row__dot--bad');
  });

  it('sin consulta enlaza limpio y por defecto el punto es neutro', () => {
    const host = render({ subject: 'A', text: 'b', cta: 'c', link: '/documentos' });
    expect(host.querySelector('a.row')?.getAttribute('href')).toBe('/documentos');
    expect(host.querySelector('.row__dot')?.className).toContain('row__dot--neutral');
  });
});
