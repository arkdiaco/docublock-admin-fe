import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  imports: [IconComponent],
  template: `<db-icon name="dashboard" [size]="18" />`,
})
class Solo {}

@Component({
  imports: [IconComponent],
  template: `
    <db-icon name="check" [size]="9" />
    <db-icon name="arrowRight" [size]="16" />
    <db-icon name="user" [size]="23" />
    <db-icon name="camera" [size]="19" />
  `,
})
class Anfitrion {}

const montar = () => {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

describe('IconComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion, Solo] }).compileComponents();
  });

  it('dibuja trazo sobre lienzo de 24, como la maqueta', () => {
    const svg = montar().querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-linecap')).toBe('round');
  });

  it('cada icono trae el grosor de trazo que le da el diseño', () => {
    const svgs = [...montar().querySelectorAll('svg')];
    expect(svgs.map((s) => s.getAttribute('stroke-width'))).toEqual(['3.2', '2', '1.7', '1.7']);
  });

  it('el tamaño lo pone quien lo usa', () => {
    const svgs = [...montar().querySelectorAll('svg')];
    expect(svgs.map((s) => s.getAttribute('width'))).toEqual(['9', '16', '23', '19']);
  });

  it('los iconos compuestos dibujan todas sus formas', () => {
    const svgs = [...montar().querySelectorAll('svg')];
    expect(svgs[0].children.length).toBe(1);
    expect(svgs[1].children.length).toBe(2);
    expect(svgs[3].querySelector('rect')).not.toBeNull();
    expect(svgs[3].querySelector('circle')).not.toBeNull();
  });

  it('una forma con relleno propio no se traza: el cuadro de acento de Dashboard', async () => {
    const fixture = TestBed.createComponent(Solo);
    fixture.detectChanges();
    const rects = [...(fixture.nativeElement as HTMLElement).querySelectorAll('svg rect')];
    const acento = rects.filter((r) => r.getAttribute('fill'));
    expect(acento.length).toBe(1);
    expect(acento[0].getAttribute('fill')).toBe('var(--db-primary-ink)');
    expect(acento[0].getAttribute('stroke')).toBe('none');
    expect(rects.length).toBe(4);
  });

  it('no es decorado para lectores de pantalla', () => {
    const svg = montar().querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });
});
