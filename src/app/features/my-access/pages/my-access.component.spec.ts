import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { MyAccessComponent } from './my-access.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const SESIONES = [
  {
    sid: 'a',
    device: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0 Safari/537.36',
    ip: '10.0.0.1',
    createdAt: '2026-10-28T10:00:00.000Z',
    lastUsedAt: '2026-10-28T11:00:00.000Z',
    expiresAt: '2026-11-04T10:00:00.000Z',
    current: true,
  },
  {
    sid: 'b',
    device: null,
    ip: null,
    createdAt: null,
    lastUsedAt: null,
    expiresAt: '2026-11-04T10:00:00.000Z',
    current: false,
  },
];

describe('MyAccessComponent', () => {
  let http: HttpTestingController;
  const dialogs = { confirm: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
        { provide: DialogService, useValue: dialogs },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'beto',
        names: 'Beto',
        surNames: 'Paz',
        email: 'beto@docublock.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformRole: 'support',
      platformPermissions: [
        'platform:clients',
        'platform:clients:manage',
        'platform:operations',
        'platform:operations:manage',
        'platform:commercial',
        'platform:catalogs',
        'platform:platform',
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(MyAccessComponent);
    fixture.detectChanges();
    http.expectOne('/platform/auth/sessions').flush({ items: SESIONES });
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('muestra mi rol, lo que puede cada área y mis sesiones con la actual marcada', async () => {
    const { host } = await montar();
    expect(host.querySelector('.role--support')).not.toBeNull();
    const textoDe = (fila: Element) =>
      Array.from(fila.querySelectorAll('.dba-td'), (celda) => celda.textContent?.trim()).join(' ');
    const areas = Array.from(
      host.querySelectorAll('dba-data-table')[0].querySelectorAll('.dba-tr'),
      textoDe,
    );
    expect(areas).toEqual([
      'Clientes Sí Sí',
      'Operación Sí Sí',
      'Comercial Sí No',
      'Catálogos Sí No',
      'Plataforma Sí No',
    ]);
    const sesiones = host.querySelectorAll('dba-data-table')[1].querySelectorAll('.dba-tr');
    expect(sesiones[0].textContent).toContain('ESTA SESIÓN');
    expect(sesiones[0].textContent).toContain('Chrome · macOS');
    expect(sesiones[1].textContent).toContain('Dispositivo sin identificar');
    expect(host.textContent).not.toMatch(/\b(staff|mine|nav|common|tbl|role)\.[a-zA-Z]/);
  });

  it('cerrar otra sesión pide confirmación y recarga', async () => {
    const { fixture, host } = await montar();
    dialogs.confirm.mockResolvedValue(true);
    host
      .querySelectorAll('dba-data-table')[1]
      .querySelector<HTMLButtonElement>('button[dba-button]')!
      .click();
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'DELETE' && r.url === '/platform/auth/sessions/b');
    });
    req.flush({ revoked: true });
    await vi.waitFor(() =>
      http.expectOne('/platform/auth/sessions').flush({ items: [SESIONES[0]] }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelectorAll('dba-data-table')[1].querySelectorAll('.dba-tr').length).toBe(1);
  });
});
