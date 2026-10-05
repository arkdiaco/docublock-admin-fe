import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { FieldComponent } from './field.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [FieldComponent],
  template: `
    <dba-field label="sys.c.domainLabel" [(value)]="domain" badge="sys.c.dnsOk" badgeTone="ok" [error]="error()" hint="auth.codeSent" />
  `,
})
class Anfitrion {
  readonly domain = signal('sierranorte.aero');
  readonly error = signal('');
}

describe('FieldComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('rótulo, valor, insignia y pista salen traducidos y el rótulo apunta al campo', () => {
    const { host } = montar();
    const label = host.querySelector<HTMLLabelElement>('.field__label')!;
    const input = host.querySelector<HTMLInputElement>('.field__input')!;
    expect(label.textContent?.trim()).toBe('Dominio verificado');
    expect(label.htmlFor).toBe(input.id);
    expect(input.value).toBe('sierranorte.aero');
    expect(host.querySelector('.field__badge--ok')?.textContent?.trim()).toBe('DNS OK');
    expect(host.querySelector('.field__note')?.textContent).toContain('código');
    expect(host.textContent).not.toMatch(/\b(sys|auth)\.[a-z]/);
  });

  it('escribir actualiza el modelo y el error desplaza la pista y marca el campo', () => {
    const { fixture, host } = montar();
    const input = host.querySelector<HTMLInputElement>('.field__input')!;
    input.value = 'nuevo.aero';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.domain()).toBe('nuevo.aero');

    fixture.componentInstance.error.set('common.required');
    fixture.detectChanges();
    expect(host.querySelector('.field--invalid')).not.toBeNull();
    expect(host.querySelector('.field__note--error')?.textContent).toContain('obligatorio');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
