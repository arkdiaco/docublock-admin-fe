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
import es from '../../../../../public/i18n/es.json';
import { OrgCreateFormComponent } from './org-create-form.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

type Form = Record<string, { set: (v: unknown) => void }> & {
  valid: () => boolean;
  pickCountry: (id: string) => void;
  submit: () => void;
  submitted: { subscribe: (fn: (v: unknown) => void) => void };
};

describe('OrgCreateFormComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgCreateFormComponent],
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

  const montar = () => {
    const fixture = TestBed.createComponent(OrgCreateFormComponent);
    fixture.componentRef.setInput('labels', {
      legal: 'Jurídica',
      natural: 'Natural',
      noReseller: 'Sin reseller',
    });
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    http.expectOne((r) => r.url === '/platform/resellers').flush({ items: [] });
    return { fixture, form: fixture.componentInstance as unknown as Form };
  };

  const llenar = (form: Form) => {
    form['businessName'].set(' Nueva ');
    form['tributaryNumber'].set('901-2');
    form.pickCountry('co');
    http
      .expectOne((r) => r.url === '/catalogs/countries/co/cities')
      .flush([{ id: 'bog', name: 'Bogotá' }]);
    form['cityId'].set('bog');
    form['email'].set('hola@nueva.co');
    form['phone'].set('3000000000');
    form['address'].set('Calle 1');
    form['adminIdentification'].set('1032');
    form['adminEmail'].set('ana@nueva.co');
    form['reason'].set('Cliente nuevo');
  };

  it('exige perfil, ubicación, primer administrador y motivo; manda solo lo escrito', async () => {
    const { form } = montar();
    expect(form.valid()).toBe(false);
    llenar(form);
    await vi.waitFor(() => expect(form.valid()).toBe(true));
    let enviado: unknown;
    form.submitted.subscribe((v) => (enviado = v));
    form.submit();
    expect(enviado).toEqual({
      businessName: 'Nueva',
      tributaryNumber: '901-2',
      type: 1,
      countryId: 'co',
      cityId: 'bog',
      phone: '3000000000',
      address: 'Calle 1',
      email: 'hola@nueva.co',
      isTest: false,
      admin: { identification: '1032', email: 'ana@nueva.co' },
      reason: 'Cliente nuevo',
    });
  });

  it('cambiar de país borra la ciudad elegida', async () => {
    const { form } = montar();
    llenar(form);
    form.pickCountry('cl');
    http.expectOne((r) => r.url === '/catalogs/countries/cl/cities').flush([]);
    await vi.waitFor(() => expect(form.valid()).toBe(false));
  });
});
