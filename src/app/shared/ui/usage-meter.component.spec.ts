import { TestBed } from '@angular/core/testing';
import { UsageMeterComponent } from './usage-meter.component';

describe('UsageMeterComponent', () => {
  const montar = (used: number, limit: number | null) => {
    const fixture = TestBed.createComponent(UsageMeterComponent);
    fixture.componentRef.setInput('used', used);
    fixture.componentRef.setInput('limit', limit);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('pinta usados sobre el límite y el tono según el 90 %', () => {
    const host = montar(190, 200);
    expect(host.querySelector('.usage__value')?.textContent).toBe('190 / 200');
    const fill = host.querySelector<HTMLElement>('.usage__fill')!;
    expect(fill.classList).toContain('usage__fill--warn');
    expect(fill.style.width).toBe('95%');
  });

  it('ilimitado se escribe ∞ y no llena la barra', () => {
    const host = montar(7, null);
    expect(host.querySelector('.usage__value')?.textContent).toBe('7 / ∞');
    expect(host.querySelector<HTMLElement>('.usage__fill')!.style.width).toBe('0%');
  });
});
