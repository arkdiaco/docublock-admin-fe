import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { OrgPickerComponent } from './org-picker.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('OrgPickerComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  interface Picker {
    options: () => { id: string; label: string }[];
    warm: () => void;
    search: (e: { filter: string }) => void;
    pick: (id: string) => void;
  }

  it('con alcance comercial consulta la ruta de comercial y emite la organización completa', async () => {
    const fixture = TestBed.createComponent(OrgPickerComponent);
    fixture.componentRef.setInput('scope', 'commercial');
    fixture.componentRef.setInput('anyKey', 'orgPicker.choose');
    fixture.detectChanges();
    const picker = fixture.componentInstance as unknown as Picker;
    const elegidas: unknown[] = [];
    fixture.componentInstance.selection.subscribe((org) => elegidas.push(org));
    expect(picker.options()[0]?.label).toBe('Elige una organización');
    picker.warm();
    http
      .expectOne((r) => r.url === '/platform/commercial/organizations')
      .flush({
        items: [{ id: 'o1', businessName: 'Puerto', tributaryNumber: '900', isReseller: true }],
      });
    await fixture.whenStable();
    picker.pick('o1');
    expect(elegidas[0]).toMatchObject({ id: 'o1', isReseller: true });
  });

  it('sin valor no pide nada hasta abrirse y ofrece «Todas» primero', async () => {
    const fixture = TestBed.createComponent(OrgPickerComponent);
    fixture.detectChanges();
    const picker = fixture.componentInstance as unknown as Picker;
    expect(picker.options()).toEqual([{ id: '', label: 'Todas las organizaciones' }]);
    picker.warm();
    const req = http.expectOne((r) => r.url === '/platform/organizations');
    expect(req.request.params.get('limit')).toBe('8');
    req.flush({
      items: [{ id: 'o1', businessName: 'Puerto', tributaryNumber: '900', state: 'active' }],
    });
    await fixture.whenStable();
    expect(picker.options()[1]).toEqual({ id: 'o1', label: 'Puerto · 900' });
    picker.warm();
    http.expectNone((r) => r.url === '/platform/organizations');
  });

  it('con un valor de la URL resuelve su nombre y lo deja primero', async () => {
    const fixture = TestBed.createComponent(OrgPickerComponent);
    fixture.componentRef.setInput('value', 'o9');
    fixture.detectChanges();
    http
      .expectOne('/platform/organizations/o9')
      .flush({ id: 'o9', businessName: 'Notaría 14', tributaryNumber: '800' });
    await fixture.whenStable();
    expect((fixture.componentInstance as unknown as Picker).options()[1]).toEqual({
      id: 'o9',
      label: 'Notaría 14 · 800',
    });
  });

  it('buscar manda el término y elegir «Todas» emite null', async () => {
    const fixture = TestBed.createComponent(OrgPickerComponent);
    fixture.detectChanges();
    const picker = fixture.componentInstance as unknown as Picker;
    const emitted: (string | null)[] = [];
    fixture.componentInstance.picked.subscribe((id) => emitted.push(id));
    picker.search({ filter: ' notar ' });
    expect(
      http.expectOne((r) => r.url === '/platform/organizations').request.params.get('search'),
    ).toBe('notar');
    picker.pick('');
    expect(emitted).toEqual([null]);
  });
});
