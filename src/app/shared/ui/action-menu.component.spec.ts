import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { ActionMenuComponent, type ActionMenuItem } from './action-menu.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [ActionMenuComponent],
  template: `
    <button type="button" class="abrir" (click)="menu.toggle($event)">abrir</button>
    <dba-action-menu
      #menu
      label="staff.actions"
      heading="Marta Vidal"
      [items]="items"
      (picked)="elegido.set($event)"
    />
  `,
})
class Anfitrion {
  readonly items: ActionMenuItem[] = [
    { key: 'role', labelKey: 'staff.action.role' },
    { key: 'remove', labelKey: 'staff.action.remove', danger: true, separated: true },
  ];
  readonly elegido = signal('');
}

describe('ActionMenuComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('abre desde su disparador, pinta las acciones traducidas y avisa cuál se eligió', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.abrir')!.click();
    fixture.detectChanges();
    const botones = () => [
      ...document.querySelectorAll<HTMLButtonElement>('.p-popover button.item'),
    ];
    await vi.waitFor(() => expect(botones().length).toBe(2));
    expect(document.querySelector('.p-popover .heading')?.textContent).toContain('Marta Vidal');
    expect(botones().map((b) => b.textContent?.trim())).toEqual(['Cambiar rol', 'Quitar acceso']);
    expect(botones()[1].classList).toContain('item--danger');
    expect(botones()[1].closest('li')?.classList).toContain('sep');
    botones()[1].click();
    expect(fixture.componentInstance.elegido()).toBe('remove');
  });

  it('una acción deshabilitada dice por qué debajo de su nombre y no se elige', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.items.push({
      key: 'quitar',
      labelKey: 'docs.signer.remove',
      danger: true,
      disabled: true,
      hintKey: 'docs.error.UNICO_FIRMANTE',
    });
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.abrir')!.click();
    fixture.detectChanges();
    const quitar = await vi.waitFor(() => {
      const found = [
        ...document.querySelectorAll<HTMLButtonElement>('.p-popover button.item'),
      ].find((button) => button.textContent?.includes('Quitar del documento'));
      expect(found).toBeDefined();
      return found!;
    });
    expect(quitar.disabled).toBe(true);
    expect(quitar.classList).toContain('item--hinted');
    expect(quitar.querySelector('.item__hint')?.textContent?.trim()).toBe(
      es.docs.error.UNICO_FIRMANTE,
    );
    const rol = [...document.querySelectorAll<HTMLButtonElement>('.p-popover button.item')].find(
      (button) => button.textContent?.includes('Cambiar rol'),
    )!;
    expect(rol.disabled).toBe(false);
    expect(rol.querySelector('.item__hint')).toBeNull();
    quitar.click();
    quitar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fixture.componentInstance.elegido()).toBe('');
  });
});
