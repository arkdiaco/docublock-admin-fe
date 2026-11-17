import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ChoiceListComponent } from './choice-list.component';

describe('ChoiceListComponent', () => {
  const montar = async (value: string | null) => {
    await TestBed.configureTestingModule({
      imports: [ChoiceListComponent],
      providers: [provideTranslateService()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChoiceListComponent);
    fixture.componentRef.setInput('options', [
      { value: 'a', labelKey: 'Primera', leadKey: 'Explica la primera' },
      { value: 'b', labelKey: 'Segunda' },
    ]);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('label', 'Elige una');
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('agrupa las opciones excluyentes con su nombre, su explicación y la elegida marcada', async () => {
    const { host } = await montar('b');
    const grupo = host.querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute('aria-label')).toBe('Elige una');
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.checked)).toEqual([false, true]);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(host.querySelectorAll('.choice')[0].textContent).toContain('Explica la primera');
    expect(host.querySelectorAll('.choice__lead').length).toBe(1);
    expect(host.querySelectorAll('.choice--on').length).toBe(1);
  });

  it('sin valor no marca ninguna y avisa la que se elige', async () => {
    const { fixture, host } = await montar(null);
    const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect([...radios].some((r) => r.checked)).toBe(false);
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);
    radios[0].dispatchEvent(new Event('change'));
    expect(picked).toHaveBeenCalledWith('a');
  });

  it('cada lista usa su propio nombre de grupo', async () => {
    const { host } = await montar('a');
    const otra = TestBed.createComponent(ChoiceListComponent);
    otra.componentRef.setInput('options', [{ value: 'a', labelKey: 'Primera' }]);
    otra.detectChanges();
    const nombre = (el: HTMLElement) => el.querySelector('input')?.getAttribute('name');
    expect(nombre(otra.nativeElement as HTMLElement)).not.toBe(nombre(host));
  });
});
