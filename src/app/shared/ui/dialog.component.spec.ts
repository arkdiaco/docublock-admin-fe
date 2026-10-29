import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { DialogComponent, type DialogRequest, type DialogResult } from './dialog.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [DialogComponent],
  template: `<db-dialog [request]="request()" (closed)="result.set($event)" />`,
})
class Anfitrion {
  readonly request = signal<DialogRequest>({
    intent: 'danger',
    icon: 'trash',
    title: '¿Eliminar 3 documentos?',
    message: 'Se moverán a la papelera.',
    confirmLabel: 'Eliminar 3 documentos',
  });
  readonly result = signal<DialogResult | null>(null);
}

let fixture: ReturnType<typeof TestBed.createComponent<Anfitrion>>;

const montar = () => {
  TestBed.inject(TranslateService).use('es');
  fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

describe('DialogComponent', () => {
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

  it('la acción vive en el botón, no en un "Aceptar" ambiguo', () => {
    const host = montar();
    const acciones = [...host.querySelectorAll('.btn')].map((b) => b.textContent?.trim());
    expect(acciones).toEqual(['Cancelar', 'Eliminar 3 documentos']);
  });

  it('cancelar va a la izquierda y la acción a la derecha', () => {
    const host = montar();
    const botones = [...host.querySelectorAll('.btn')];
    expect(botones[0].classList.contains('btn--ghost')).toBe(true);
    expect(botones[1].classList.contains('btn--danger')).toBe(true);
  });

  it('la intención tiñe el diálogo entero, no solo el botón', () => {
    const host = montar();
    expect(host.querySelector('.box')?.classList.contains('box--danger')).toBe(true);

    fixture.componentInstance.request.set({
      intent: 'success',
      layout: 'status',
      title: 'Documento firmado',
      confirmLabel: 'Ver documento',
    });
    fixture.detectChanges();
    expect(host.querySelector('.box')?.classList.contains('box--success')).toBe(true);
  });

  it('lo destructivo puede llevar borde en vez de relleno cuando no es el camino esperado', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      intent: 'danger',
      outlined: true,
      title: 'Salir sin guardar',
      confirmLabel: 'Salir sin guardar',
    });
    fixture.detectChanges();
    expect(host.querySelector('.btn--danger')).toBeNull();
    expect(host.querySelector('.btn--dangerOutline')).not.toBeNull();
  });

  it('la alerta de estado apila los botones y pone el primario arriba', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      layout: 'status',
      intent: 'success',
      title: 'Documento firmado',
      confirmLabel: 'Ver documento',
      secondaryLabel: 'Descargar constancia',
    });
    fixture.detectChanges();

    expect(host.querySelector('.foot--stacked')).not.toBeNull();
    expect(host.querySelector('.box__stripe')).not.toBeNull();
    const botones = [...host.querySelectorAll('.btn')].map((b) => b.textContent?.trim());
    expect(botones).toEqual(['Ver documento', 'Descargar constancia']);
  });

  it('cada tamaño es el declarado por el sistema', () => {
    const host = montar();
    const ancho = () =>
      (host.querySelector('.box') as HTMLElement).style.getPropertyValue('--db-dialog-width');

    expect(ancho()).toBe('460px');

    fixture.componentInstance.request.set({ size: 'compact', title: 'a', confirmLabel: 'b' });
    fixture.detectChanges();
    expect(ancho()).toBe('400px');

    fixture.componentInstance.request.set({ layout: 'context', title: 'a', confirmLabel: 'b' });
    fixture.detectChanges();
    expect(ancho()).toBe('540px');
  });

  it('el motivo escrito vuelve con la respuesta', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      layout: 'context',
      intent: 'danger',
      title: 'Rechazar documento',
      confirmLabel: 'Rechazar documento',
      reason: {
        labelKey: 'dialog.reason',
        placeholder: 'Motivo',
        limit: 300,
        quick: ['Datos incorrectos'],
      },
    });
    fixture.detectChanges();

    const texto = host.querySelector<HTMLTextAreaElement>('.body__text')!;
    texto.value = 'El canon no coincide';
    texto.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('.btn--danger')!.click();
    expect(fixture.componentInstance.result()).toEqual({
      answer: 'confirm',
      reason: 'El canon no coincide',
    });
  });

  it('el placeholder del motivo se traduce si llega como llave y queda tal cual si es texto', () => {
    const host = montar();
    const pedir = (placeholder: string) => {
      fixture.componentInstance.request.set({
        layout: 'confirm',
        intent: 'danger',
        title: 'Rechazar la solicitud',
        confirmLabel: 'Rechazar',
        reason: { labelKey: 'auth.code', placeholder, limit: 300, quick: [] },
      });
      fixture.detectChanges();
      return host.querySelector<HTMLTextAreaElement>('.body__text')?.placeholder;
    };
    expect(pedir('auth.identification')).toBe('Número de identificación');
    expect(pedir('ana@empresa.com, luis@empresa.com')).toBe('ana@empresa.com, luis@empresa.com');
  });

  it('los motivos rápidos rellenan el campo', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      layout: 'context',
      title: 'Rechazar documento',
      confirmLabel: 'Rechazar',
      reason: {
        labelKey: 'dialog.reason',
        placeholder: 'Motivo',
        limit: 300,
        quick: ['Datos incorrectos', 'No corresponde'],
      },
    });
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('.body__chip')!.click();
    fixture.detectChanges();
    expect(host.querySelector<HTMLTextAreaElement>('.body__text')?.value).toBe(
      'Datos incorrectos',
    );
  });

  it('Escape y el telón cancelan', () => {
    const host = montar();
    host.querySelector<HTMLElement>('.box')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(fixture.componentInstance.result()?.answer).toBe('cancel');

    fixture.componentInstance.result.set(null);
    host.querySelector<HTMLElement>('.scrim')!.click();
    expect(fixture.componentInstance.result()?.answer).toBe('cancel');
  });

  it('el medidor de cupo se anuncia con sus topes', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      layout: 'status',
      intent: 'warn',
      title: 'Te quedan 40 documentos',
      confirmLabel: 'Ampliar plan',
      meter: { used: 160, quota: 200, labelKey: 'dialog.quotaMeter' },
    });
    fixture.detectChanges();

    const medidor = host.querySelector('.meter');
    expect(medidor?.getAttribute('role')).toBe('meter');
    expect(medidor?.getAttribute('aria-valuenow')).toBe('160');
    expect(medidor?.getAttribute('aria-valuemax')).toBe('200');
    expect(host.querySelector<HTMLElement>('.meter__fill')?.style.width).toBe('80%');
  });

  it('se anuncia como diálogo y toma su nombre del título', () => {
    const host = montar();
    const caja = host.querySelector('.box');
    expect(caja?.getAttribute('role')).toBe('dialog');
    expect(caja?.getAttribute('aria-modal')).toBe('true');
    expect(host.querySelector('#dbDialogTitle')?.textContent?.trim()).toBe(
      '¿Eliminar 3 documentos?',
    );
  });

  it('los iconos son de trazo', () => {
    const host = montar();
    expect(host.querySelectorAll('.pi').length).toBe(0);
    const svgs = [...host.querySelectorAll('db-icon svg')];
    expect(svgs.length).toBe(1);
    expect(svgs.every((s) => s.getAttribute('fill') === 'none')).toBe(true);
  });

  it('la confirmación destructiva exige escribir el identificador, sin distinguir mayúsculas', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      intent: 'danger',
      title: 'sys.c.suspendTitle',
      confirmLabel: 'sys.c.suspend',
      challenge: { identifier: 'ORG-0412', actionKey: 'sys.c.suspendVerb' },
    });
    fixture.detectChanges();

    const confirmar = host.querySelectorAll<HTMLButtonElement>('.btn')[1];
    const campo = host.querySelector<HTMLInputElement>('.body__challengeInput')!;
    expect(host.querySelector('.body__challengeText')?.textContent).toContain('Escribe');
    expect(host.querySelector('.body__challengeId')?.textContent).toBe('ORG-0412');
    expect(host.querySelector('.body__challengeText')?.textContent).toContain('para suspender');
    expect(campo.placeholder).toBe('ORG-');
    expect(confirmar.disabled).toBe(true);

    campo.value = 'org-041';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.disabled).toBe(true);

    campo.value = 'org-0412';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.disabled).toBe(false);
    confirmar.click();
    expect(fixture.componentInstance.result()?.answer).toBe('confirm');
  });

  it('con motivo obligatorio no confirma hasta que se escribe algo', () => {
    const host = montar();
    fixture.componentInstance.request.set({
      intent: 'danger',
      title: 'staff.suspend.title',
      confirmLabel: 'staff.suspend.confirm',
      reason: { labelKey: 'staff.reasonLabel', placeholder: 'staff.reasonPlaceholder', limit: 500, quick: [], required: true },
    });
    fixture.detectChanges();

    const confirmar = host.querySelectorAll<HTMLButtonElement>('.btn')[1];
    const motivo = host.querySelector<HTMLTextAreaElement>('.body__text')!;
    expect(confirmar.disabled).toBe(true);

    motivo.value = '   ';
    motivo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.disabled).toBe(true);

    motivo.value = 'Salió de la empresa';
    motivo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.disabled).toBe(false);
    confirmar.click();
    expect(fixture.componentInstance.result()).toEqual({ answer: 'confirm', reason: 'Salió de la empresa' });
  });
});
