import { TestBed } from '@angular/core/testing';
import {
  BarChartComponent,
  niceTicks,
  type BarChartCategory,
  type BarChartSeries,
} from './bar-chart.component';

const MESES: BarChartCategory[] = [
  { key: '1', label: 'Ene' },
  { key: '2', label: 'Feb' },
  { key: '3', label: 'Mar' },
];

const montar = (
  series: BarChartSeries[],
  format?: (value: number) => string,
): HTMLElement => {
  const fixture = TestBed.createComponent(BarChartComponent);
  fixture.componentRef.setInput('categories', MESES);
  fixture.componentRef.setInput('series', series);
  fixture.componentRef.setInput('label', 'Transacciones por mes');
  if (format) fixture.componentRef.setInput('format', format);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

const alturas = (host: HTMLElement, serie: number): string[] =>
  [...host.querySelectorAll<HTMLElement>(`.chart__bar--${serie}:not(.chart__swatch)`)].map(
    (bar) => bar.style.height,
  );

describe('niceTicks', () => {
  it('reparte el eje en pasos redondos que cubren el máximo', () => {
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(400)).toEqual([0, 100, 200, 300, 400]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(0.3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('sin datos queda solo el cero', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(Number.NaN)).toEqual([0]);
  });
});

describe('BarChartComponent', () => {
  it('mide cada barra contra el tope del eje y agrupa las series por mes', () => {
    const host = montar([
      { key: 'ok', label: 'Aprobadas', values: [50, 25, 0] },
      { key: 'all', label: 'Totales', values: [100, 40, 10] },
    ]);
    expect(alturas(host, 0)).toEqual(['50%', '25%', '0%']);
    expect(alturas(host, 1)).toEqual(['100%', '40%', '10%']);
    expect(host.querySelectorAll('.chart__x').length).toBe(3);
    expect(host.querySelector('.chart__legend')?.textContent).toContain('Aprobadas');
    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Transacciones por mes',
    );
  });

  it('una sola serie no pinta leyenda y la tabla oculta lleva los valores', () => {
    const host = montar([{ key: 'docs', label: 'Documentos', values: [1200, 0, 3] }]);
    expect(host.querySelector('.chart__legend')).toBeNull();
    const celdas = [...host.querySelectorAll('table td')].map((td) => td.textContent?.trim());
    expect(celdas).toEqual(['1,200', '0', '3']);
  });

  it('usa el formato que le pasen y no pasa de tres series', () => {
    const host = montar(
      [
        { key: 'a', label: 'A', values: [1, 2, 3] },
        { key: 'b', label: 'B', values: [1, 2, 3] },
        { key: 'c', label: 'C', values: [1, 2, 3] },
        { key: 'd', label: 'D', values: [1, 2, 3] },
      ],
      (value) => `$ ${value}`,
    );
    expect(host.querySelectorAll('.chart__key').length).toBe(3);
    expect(host.querySelector('.chart__tick')?.textContent?.trim()).toBe('$ 3');
  });

  it('todo en cero no divide por cero', () => {
    const host = montar([{ key: 'a', label: 'A', values: [0, 0, 0] }]);
    expect(alturas(host, 0)).toEqual(['0%', '0%', '0%']);
  });
});
