import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

@Component({
  imports: [LoaderComponent],
  template: `<db-loader [label]="etiqueta" [size]="'32px'" />`,
})
class Anfitrion {
  etiqueta = 'Cargando documentos';
}

describe('LoaderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
  });

  it('anuncia estado, respeta el tamaño y pinta la etiqueta solo si llega', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const caja = host.querySelector<HTMLElement>('.ld')!;
    expect(caja.getAttribute('role')).toBe('status');
    expect(caja.style.getPropertyValue('--ld-size')).toBe('32px');
    expect(host.querySelector('.ld__label')?.textContent?.trim()).toBe('Cargando documentos');

    expect(host.querySelector('.ld__ink path')?.getAttribute('d')?.startsWith('M119.31')).toBe(true);
    expect(host.querySelector('.ld__rise')).not.toBeNull();
    expect(host.querySelector('.ld__bar')).toBeNull();

    fixture.componentInstance.etiqueta = '';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(host.querySelector('.ld__label')).toBeNull();
  });

  it('a página completa muestra la marca, la barra, los mensajes en turno y la nota de conexión', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('variant', 'page');
    fixture.componentRef.setInput('messages', ['Verificando tu enlace', 'Preparando el documento']);
    fixture.componentRef.setInput('footnote', 'Conexión cifrada');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.ld--page')?.getAttribute('role')).toBe('status');
    expect(host.querySelector('.ld__word')?.getAttribute('alt')).toBe('Docublock');
    expect(host.querySelector('.ld__bar')).not.toBeNull();
    expect(host.querySelector('.ld__message')?.textContent?.trim()).toBe('Verificando tu enlace');
    vi.advanceTimersByTime(1300);
    fixture.detectChanges();
    expect(host.querySelector('.ld__message')?.textContent?.trim()).toBe('Preparando el documento');
    expect(host.querySelector('.ld__foot')?.textContent?.trim()).toBe('Conexión cifrada');
    fixture.destroy();
    vi.useRealTimers();
  });

  it('a 20 px o menos corre más rápido para que se note en botones y filas', () => {
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('size', '16px');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ld')?.classList).toContain('ld--compact');
    fixture.componentRef.setInput('size', '48px');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ld')?.classList).not.toContain('ld--compact');
  });
});
