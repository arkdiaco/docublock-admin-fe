import { TestBed } from '@angular/core/testing';
import { SectionLoaderComponent } from './section-loader.component';

describe('SectionLoaderComponent', () => {
  it('centra el loader de la casa con su etiqueta en todo el ancho de la sección', async () => {
    await TestBed.configureTestingModule({ imports: [SectionLoaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SectionLoaderComponent);
    fixture.componentRef.setInput('label', 'Cargando pagarés');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.ld__label')?.textContent?.trim()).toBe('Cargando pagarés');
    expect(host.getAttribute('aria-busy')).toBe('true');
  });
});
