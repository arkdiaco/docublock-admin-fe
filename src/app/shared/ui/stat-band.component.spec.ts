import { TestBed } from '@angular/core/testing';
import { StatBandComponent, type StatCell } from './stat-band.component';

const CELDAS: StatCell[] = [
  { key: 'all', label: 'En riesgo', value: '3', note: 'total a atender' },
  { key: 'critical', label: 'Críticas', value: '1', tone: 'danger' },
];

describe('StatBandComponent', () => {
  const montar = (interactive: boolean, active: string | null = null) => {
    const fixture = TestBed.createComponent(StatBandComponent);
    fixture.componentRef.setInput('cells', CELDAS);
    fixture.componentRef.setInput('interactive', interactive);
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('fija sin botones pinta etiqueta, valor, tono y nota solo cuando la hay', () => {
    const { host } = montar(false);
    expect(host.querySelectorAll('button')).toHaveLength(0);
    const celdas = host.querySelectorAll('article.band__cell');
    expect(celdas[0].querySelector('.band__note')?.textContent?.trim()).toBe('total a atender');
    expect(celdas[1].querySelector('.band__note')).toBeNull();
    expect(celdas[1].querySelector('.band__value--danger')?.textContent?.trim()).toBe('1');
  });

  it('interactiva marca la activa y avisa la que se toca', () => {
    const { fixture, host } = montar(true, 'critical');
    const elegidas: string[] = [];
    fixture.componentInstance.picked.subscribe((key) => elegidas.push(key));
    const botones = host.querySelectorAll<HTMLButtonElement>('button.band__cell');
    expect([...botones].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(botones[1].classList).toContain('band__cell--on');
    botones[0].click();
    expect(elegidas).toEqual(['all']);
  });
});
