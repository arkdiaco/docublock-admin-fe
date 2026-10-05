import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `
    <button dba-button class="p" (click)="clicks.set(clicks() + 1)">Guardar</button>
    <button dba-button variant="secondary" class="s">Cancelar</button>
    <button dba-button variant="destructive" class="d" [disabled]="locked()" (click)="clicks.set(clicks() + 1)">Suspender</button>
    <button dba-button variant="dark" class="k" iconOnly>·</button>
    <button dba-button class="b" [busy]="busy()">Enviar</button>
  `,
})
class Anfitrion {
  readonly clicks = signal(0);
  readonly locked = signal(true);
  readonly busy = signal(false);
}

describe('ButtonComponent', () => {
  const montar = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('cada variante lleva su clase y la de icono es cuadrada', () => {
    const { host } = montar();
    expect(host.querySelector('.p')?.classList.contains('btn--primary')).toBe(true);
    expect(host.querySelector('.s')?.classList.contains('btn--secondary')).toBe(true);
    expect(host.querySelector('.d')?.classList.contains('btn--destructive')).toBe(true);
    expect(host.querySelector('.k')?.classList.contains('btn--dark')).toBe(true);
    expect(host.querySelector('.k')?.classList.contains('btn--icon')).toBe(true);
  });

  it('deshabilitado no dispara el clic y ocupado también bloquea', () => {
    const { fixture, host } = montar();
    host.querySelector<HTMLButtonElement>('.p')!.click();
    host.querySelector<HTMLButtonElement>('.d')!.click();
    expect(fixture.componentInstance.clicks()).toBe(1);
    expect(host.querySelector('.d')?.hasAttribute('disabled')).toBe(true);

    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    const ocupado = host.querySelector('.b')!;
    expect(ocupado.hasAttribute('disabled')).toBe(true);
    expect(ocupado.getAttribute('aria-busy')).toBe('true');
    expect(ocupado.querySelector('db-loader')).not.toBeNull();
  });
});
