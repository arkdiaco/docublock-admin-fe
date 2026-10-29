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
import es from '../../../../../../public/i18n/es.json';
import type { PlatformOrgRow } from '../../data/organizations.models';
import { TransferDocumentsFormComponent } from './transfer-documents-form.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const row = (id: string, limit: number | null): PlatformOrgRow =>
  ({
    id,
    businessName: id.toUpperCase(),
    tributaryNumber: '9',
    documents: { used: 2, limit },
  }) as PlatformOrgRow;

interface Form {
  targetId: { set: (v: string) => void };
  amount: { set: (v: string) => void };
  reason: { set: (v: string) => void };
  options: () => { id: string }[];
  amountError: () => string;
  valid: () => boolean;
  summary: () => { source: number; target: string } | null;
}

describe('TransferDocumentsFormComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferDocumentsFormComponent],
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

  const montar = async () => {
    const fixture = TestBed.createComponent(TransferDocumentsFormComponent);
    fixture.componentRef.setInput('orgId', 'a');
    fixture.componentRef.setInput('orgName', 'A');
    fixture.componentRef.setInput('available', 10);
    fixture.componentRef.setInput('texts', {
      targetHas: () => 'tiene',
      targetAfter: (r: PlatformOrgRow, n: number) => `${r.businessName}+${n}`,
    });
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/platform/organizations')
      .flush({ total: 3, counts: {}, items: [row('a', 50), row('b', 20), row('c', null)] });
    const form = fixture.componentInstance as unknown as Form;
    await vi.waitFor(() => expect(form.options().length).toBe(2));
    return form;
  };

  it('no ofrece la propia organización y no deja pasar de los disponibles', async () => {
    const form = await montar();
    expect(form.options().map((o) => o.id)).toEqual(['b', 'c']);
    form.targetId.set('b');
    form.amount.set('11');
    form.reason.set('Ajuste comercial');
    expect(form.amountError()).toBe('sub.transfer.tooMany');
    expect(form.valid()).toBe(false);
    form.amount.set('4');
    expect(form.valid()).toBe(true);
    expect(form.summary()).toEqual({ source: 6, target: 'B+4' });
  });

  it('un destino ilimitado no se puede elegir para transferir', async () => {
    const form = await montar();
    form.targetId.set('c');
    form.amount.set('1');
    form.reason.set('x');
    expect(form.valid()).toBe(false);
  });
});
