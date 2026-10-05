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
import { ModalShellComponent } from './modal-shell.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [ModalShellComponent],
  template: `
    <db-modal-shell
      [icon]="'shieldCheck'"
      title="Asignar plan"
      subtitle="Edificio Inmobiliario SAS"
      [confirmLabel]="'auth.enter'"
      [confirmDisabled]="bloqueado()"
      [busy]="ocupado()"
      (dismissed)="cierres = cierres + 1"
      (confirmed)="confirmaciones = confirmaciones + 1"
    >
      <p class="contenido">Cuerpo proyectado</p>
    </db-modal-shell>
  `,
})
class Anfitrion {
  readonly bloqueado = signal(true);
  readonly ocupado = signal(false);
  cierres = 0;
  confirmaciones = 0;
}

describe('ModalShellComponent', () => {
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
  });

  it('proyecta el cuerpo, traduce los botones y respeta el bloqueo del principal', () => {
    TestBed.inject(TranslateService).use('es');
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.head__title')?.textContent?.trim()).toBe('Asignar plan');
    expect(host.querySelector('.body .contenido')?.textContent).toContain('Cuerpo proyectado');
    expect(host.querySelector('.foot__ghost')?.textContent?.trim()).toBe('Cancelar');
    expect(host.querySelector('.foot__go')?.textContent?.trim()).toBe('Entrar');
    expect(host.querySelector<HTMLButtonElement>('.foot__go')?.disabled).toBe(true);

    fixture.componentInstance.bloqueado.set(false);
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.foot__go')!.click();
    expect(fixture.componentInstance.confirmaciones).toBe(1);

    host.querySelector<HTMLButtonElement>('.scrim')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.cierres).toBe(2);
  });

  it('mientras confirma muestra el loader en el botón y no deja confirmar dos veces', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.bloqueado.set(false);
    fixture.componentInstance.ocupado.set(true);
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.foot__go')!;
    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute('aria-busy')).toBe('true');
    expect(boton.querySelector('db-loader')).not.toBeNull();
    fixture.componentInstance.ocupado.set(false);
    fixture.detectChanges();
    expect(boton.disabled).toBe(false);
    expect(boton.querySelector('db-loader')).toBeNull();
  });
});
