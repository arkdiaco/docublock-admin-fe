import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BusyIconComponent } from './busy-icon.component';

@Component({
  imports: [BusyIconComponent],
  template: `<button type="button"><db-busy-icon [busy]="busy()" icon="send" [size]="16" /></button>`,
})
class Anfitrion {
  readonly busy = signal(false);
}

describe('BusyIconComponent', () => {
  it('muestra el icono y, mientras la acción corre, el loader de la casa del mismo tamaño y del color del botón', async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('db-icon')).not.toBeNull();
    expect(host.querySelector('db-loader')).toBeNull();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(host.querySelector('db-icon')).toBeNull();
    const loader = host.querySelector<HTMLElement>('db-loader .ld')!;
    expect(loader.style.getPropertyValue('--ld-size')).toBe('16px');
    expect(host.querySelector('db-loader')?.classList).toContain('busy__loader');
  });
});
