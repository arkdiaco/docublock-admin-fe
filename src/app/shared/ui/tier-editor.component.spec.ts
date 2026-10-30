import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TierEditorComponent } from './tier-editor.component';

describe('TierEditorComponent', () => {
  const montar = (tiers: { minQuantity: string; discountPct: string }[]) => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    const fixture = TestBed.createComponent(TierEditorComponent);
    fixture.componentRef.setInput('tiers', tiers);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('agrega un tramo que dobla la cantidad anterior y quita el elegido', () => {
    const { fixture, host } = montar([{ minQuantity: '100', discountPct: '0' }]);
    host.querySelector<HTMLButtonElement>('.tiers__add')!.click();
    expect(fixture.componentInstance.tiers()).toEqual([
      { minQuantity: '100', discountPct: '0' },
      { minQuantity: '200', discountPct: '0' },
    ]);
    fixture.detectChanges();
    host.querySelectorAll<HTMLButtonElement>('.tiers__row button')[0].click();
    expect(fixture.componentInstance.tiers()).toEqual([{ minQuantity: '200', discountPct: '0' }]);
  });

  it('escribir actualiza el tramo y avisa si las cantidades no crecen', () => {
    const { fixture, host } = montar([
      { minQuantity: '100', discountPct: '0' },
      { minQuantity: '300', discountPct: '5' },
    ]);
    const input = host.querySelectorAll<HTMLInputElement>('.tiers__input')[2];
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.tiers()[1].minQuantity).toBe('50');
    expect(host.querySelector('.tiers__error')?.textContent?.trim()).toBe('tiers.notAscending');
  });

  it('sin tramos muestra el texto vacío', () => {
    const { host } = montar([]);
    expect(host.querySelector('.tiers__empty')?.textContent?.trim()).toBe('tiers.empty');
  });
});
