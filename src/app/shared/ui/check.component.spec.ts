import { TestBed } from '@angular/core/testing';
import { CheckComponent } from './check.component';

describe('CheckComponent', () => {
  it('refleja el estado, lleva su etiqueta y avisa al cambiar', async () => {
    await TestBed.configureTestingModule({ imports: [CheckComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CheckComponent);
    fixture.componentRef.setInput('checked', true);
    fixture.componentRef.setInput('label', 'Marcar a Ana');
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.getAttribute('aria-label')).toBe('Marcar a Ana');
    const toggled = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggled);
    box.dispatchEvent(new Event('change'));
    expect(toggled).toHaveBeenCalledOnce();
  });
});
