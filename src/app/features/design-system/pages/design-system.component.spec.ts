import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { DialogService } from '../../../core/ui/dialog.service';
import { DesignSystemComponent } from './design-system.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('DesignSystemComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = () => {
    const fixture = TestBed.createComponent(DesignSystemComponent);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('muestra la rampa completa con el 500 marcado como primario', () => {
    const { host } = montar();
    expect(host.querySelectorAll('.ramp__step').length).toBe(11);
    expect(host.querySelector('.ramp__n--primary')?.textContent?.trim()).toBe('500');
    expect(host.querySelectorAll('.ramp__hex')[5].textContent?.trim()).toBe('#7954FD');
  });

  it('pinta los cinco estados con su forma de punto, en píldora y en fila, y los cuatro roles', () => {
    const { host } = montar();
    const formas = Array.from(host.querySelectorAll('.row .st--pill .st__dot')).map((dot) => dot.className.replace(/.*st__dot--(\w+).*/, '$1'));
    expect(formas).toEqual(['circle', 'ring', 'square', 'square', 'dash']);
    expect(host.querySelectorAll('.card .st--inline').length).toBe(5);
    expect(host.querySelectorAll('dba-role-tag').length).toBe(4);
    expect(host.querySelector('.st--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.role--superadmin')?.textContent).toMatch(/superadmin/i);
  });

  it('las muestras tipográficas usan las clases de la casa', () => {
    const { host } = montar();
    expect(host.querySelectorAll('.type__row').length).toBe(7);
    expect(host.querySelector('.type__row .dba-kpi')?.textContent?.trim()).toBe('312');
    expect(host.querySelector('.type__row .dba-id')).not.toBeNull();
  });

  it('el cuadro de componentes trae acciones, campo, KPI, cuotas, módulos, eventos, filtros y entornos', () => {
    const { fixture, host } = montar();
    const variantes = Array.from(host.querySelectorAll('.cards [dba-button]')).map(
      (b) => b.className.match(/btn--(primary|secondary|destructive|dark)/)?.[1],
    );
    expect(variantes).toEqual(['primary', 'secondary', 'dark', 'secondary', 'destructive', 'secondary']);
    expect(host.querySelector<HTMLInputElement>('dba-field .field__input')?.value).toBe('sierranorte.aero');
    expect(host.querySelectorAll('dba-kpi-card').length).toBe(4);
    expect(host.querySelectorAll('dba-quota-bar').length).toBe(3);
    expect(host.querySelector('.quota__fill--warn')).not.toBeNull();
    expect(host.querySelectorAll('[role="switch"][aria-checked="true"]').length).toBe(3);
    expect(host.querySelectorAll('dba-audit-event').length).toBe(4);
    expect(host.querySelectorAll('.pill').length).toBe(5);
    expect(host.querySelectorAll('dba-env-pill').length).toBe(3);

    host.querySelectorAll<HTMLButtonElement>('[role="switch"]')[3].click();
    fixture.detectChanges();
    expect(host.querySelectorAll('[role="switch"][aria-checked="true"]').length).toBe(4);
    expect(host.querySelectorAll('.mod__meta')[3].textContent).toContain('usuarios');

    host.querySelectorAll<HTMLButtonElement>('.pill')[2].click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.pill')[2].classList.contains('pill--on')).toBe(true);
  });

  it('la confirmación destructiva abre el diálogo real con el identificador y refleja la respuesta', async () => {
    const { fixture, host } = montar();
    const dialogs = TestBed.inject(DialogService);
    host.querySelector<HTMLButtonElement>('.challenge')!.click();
    const pedido = dialogs.request();
    expect(pedido?.challenge?.identifier).toBe('ORG-0412');
    expect(pedido?.intent).toBe('danger');
    dialogs.close({ answer: 'confirm' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.challenge__result')?.textContent).toContain('Confirmada');
  });

  it('trae la tabla densa con 10 filas, 7 columnas, la fila elegida en morado y la paginación en ventana', () => {
    const { fixture, host } = montar();
    expect(host.querySelectorAll('.tbl__th').length).toBe(7);
    expect(host.querySelectorAll('dba-data-table .dba-tr').length).toBe(10);
    expect(host.querySelector('.dba-tr--on .org-id')?.textContent?.trim()).toBe('ORG-0412');
    expect(host.querySelector('.tbl__range')?.textContent).toContain('1\u201310 de 312');
    expect([...host.querySelectorAll('.tbl__page')].map((b) => b.textContent?.trim())).toEqual(['1', '2', '32']);
    expect(host.querySelector('.usage__fill--warn')).not.toBeNull();

    host.querySelectorAll<HTMLButtonElement>('dba-data-table .dba-tr')[3].click();
    fixture.detectChanges();
    expect(host.querySelector('.dba-tr--on .org-id')?.textContent?.trim()).toBe('ORG-0419');
  });

  it('la cabecera de ficha trae migas, nombre, estado y las seis pestañas', () => {
    const { host } = montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Aeropuerto Sierra Norte');
    expect(host.querySelector('dba-record-header .st--active')).not.toBeNull();
    expect(host.querySelectorAll('db-underline-tabs .tab').length).toBe(6);
    expect(host.querySelector('db-underline-tabs .tab--on')?.textContent).toContain('Resumen');
  });

  it('nada sale como llave cruda', () => {
    const { host } = montar();
    expect(host.textContent).not.toMatch(/\b(sys|org|role|shell|env|common|dialog|nav)\.[a-zA-Z]/);
  });
});
