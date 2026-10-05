import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModuleToggleComponent } from './module-toggle.component';

@Component({
  imports: [ModuleToggleComponent],
  template: `<dba-module-toggle abbr="PG" name="Pagarés" meta="v1.4 · 48 usuarios" [on]="on()" [disabled]="locked()" (toggled)="on.set($event)" />`,
})
class Anfitrion {
  readonly on = signal(true);
  readonly locked = signal(false);
}

describe('ModuleToggleComponent', () => {
  const montar = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('es un interruptor accesible que emite el estado contrario', () => {
    const { fixture, host } = montar();
    const sw = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.getAttribute('aria-label')).toBe('Pagarés');
    expect(host.querySelector('.mod--on')).not.toBeNull();
    expect(host.querySelector('.mod__tile')?.textContent?.trim()).toBe('PG');

    sw.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.on()).toBe(false);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(host.querySelector('.mod--on')).toBeNull();
  });

  it('deshabilitado no cambia', () => {
    const { fixture, host } = montar();
    fixture.componentInstance.locked.set(true);
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    expect(fixture.componentInstance.on()).toBe(true);
  });
});
