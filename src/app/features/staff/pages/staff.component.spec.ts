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
import { MessageService, type MenuItem } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import type { StaffMember } from '../data/staff.models';
import { StaffComponent } from './staff.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const miembro = (overrides: Partial<StaffMember>): StaffMember => ({
  id: 'ana',
  email: 'ana@docublock.co',
  names: 'Ana',
  surNames: 'Ruiz',
  role: 'superadmin',
  status: 'ACTIVE',
  permissions: [],
  lastLoginAt: '2026-10-28T15:30:00.000Z',
  createdAt: null,
  activeSessions: 1,
  isSelf: false,
  ...overrides,
});

const LISTA = [
  miembro({ isSelf: true }),
  miembro({
    id: 'beto',
    email: 'beto@docublock.co',
    names: 'Beto',
    surNames: 'Paz',
    role: 'support',
    activeSessions: 2,
  }),
  miembro({
    id: 'caro',
    email: 'caro@docublock.co',
    names: 'Caro',
    surNames: 'Gil',
    role: 'readonly',
    status: 'SUSPENDED',
    lastLoginAt: null,
  }),
];

describe('StaffComponent', () => {
  let http: HttpTestingController;
  const dialogs = { open: vi.fn(), confirm: vi.fn() };
  const avisos = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
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
        { provide: NotificationService, useValue: avisos },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(StaffComponent);
    fixture.detectChanges();
    http.expectOne('/platform/staff').flush({ items: LISTA });
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  const accionesDe = async (
    fixture: Awaited<ReturnType<typeof montar>>['fixture'],
    fila: number,
  ) => {
    const host = fixture.nativeElement as HTMLElement;
    const filas = host.querySelectorAll<HTMLElement>('.dba-tr');
    filas.item(fila).querySelector<HTMLButtonElement>('.staff__more')!.click();
    fixture.detectChanges();
    return (
      fixture.componentInstance as unknown as { actionItems: () => MenuItem[] }
    ).actionItems();
  };

  const recargar = async (fixture: Awaited<ReturnType<typeof montar>>['fixture']) => {
    await Promise.resolve();
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/platform/staff')
      .flush({ items: LISTA });
    await fixture.whenStable();
  };

  it('pinta al personal con rol, estado, último ingreso, sesiones y quién soy', async () => {
    const { host } = await montar();
    const filas = host.querySelectorAll('dba-data-table .dba-tr');
    expect(filas.length).toBe(3);
    expect(filas[0].textContent).toContain('TÚ');
    expect(filas[0].querySelector('.staff__more')).toBeNull();
    expect(filas[1].querySelector('.role--support')).not.toBeNull();
    expect(filas[1].querySelector('.staff__sessions')?.textContent?.trim()).toBe('2');
    expect(filas[2].textContent).toContain('Suspendido');
    expect(filas[2].textContent).toContain('Nunca');
    expect(host.textContent).toContain('3 personas · superadmins activos: 1');
    expect(host.textContent).not.toMatch(/\b(staff|mine|nav|common|tbl|role)\.[a-zA-Z]/);
  });

  it('filtrar por suspendidos deja solo esas filas, sin volver a pedir', async () => {
    const { fixture, host } = await montar();
    host.querySelectorAll<HTMLButtonElement>('.pill')[2].click();
    fixture.detectChanges();
    expect(host.querySelectorAll('dba-data-table .dba-tr').length).toBe(1);
  });

  it('dar acceso envía el formulario y recarga la lista', async () => {
    const { fixture, host } = await montar();
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')]
      .find((b) => b.textContent?.includes('Dar acceso'))!
      .click();
    fixture.detectChanges();
    const campos = document.querySelectorAll<HTMLInputElement>('dba-staff-form .field__input');
    const escribir = (campo: HTMLInputElement, valor: string) => {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    };
    escribir(campos[0], 'dani@docublock.co');
    escribir(campos[1], 'Dani');
    escribir(campos[2], 'Mora');
    document.querySelector<HTMLInputElement>('dba-staff-form input[value="support"]')!.click();
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>('dba-staff-form .foot__go')!.click();
    const req = http.expectOne((r) => r.method === 'POST' && r.url === '/platform/staff');
    expect(req.request.body).toEqual({
      email: 'dani@docublock.co',
      names: 'Dani',
      surNames: 'Mora',
      role: 'support',
    });
    req.flush(miembro({ id: 'dani', email: 'dani@docublock.co' }));
    await recargar(fixture);
    expect(avisos.success).toHaveBeenCalledWith('dani@docublock.co ya puede entrar a la consola');
  });

  it('suspender pide motivo y lo manda con el estado', async () => {
    const { fixture } = await montar();
    dialogs.open.mockResolvedValue({ answer: 'confirm', reason: 'Salió de la empresa' });
    const acciones = await accionesDe(fixture, 1);
    acciones.find((a) => a.label === 'Suspender')!.command!({});
    await Promise.resolve();
    expect(dialogs.open.mock.calls[0][0].reason.required).toBe(true);
    await vi.waitFor(() =>
      http.expectOne((r) => r.method === 'PATCH' && r.url === '/platform/staff/beto'),
    );
  });

  it('quitar el acceso exige escribir el correo y muestra el error del backend', async () => {
    const { fixture } = await montar();
    dialogs.open.mockResolvedValue({ answer: 'confirm', reason: 'Fin de contrato' });
    const acciones = await accionesDe(fixture, 1);
    acciones.find((a) => a.label === 'Quitar acceso')!.command!({});
    await vi.waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    expect(dialogs.open.mock.calls[0][0].challenge.identifier).toBe('beto@docublock.co');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'DELETE' && r.url === '/platform/staff/beto');
    });
    expect(req.request.body).toEqual({ reason: 'Fin de contrato' });
    req.flush({ code: 'ULTIMO_SUPERADMIN', message: 'x' }, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() =>
      expect(avisos.error).toHaveBeenCalledWith(
        'Es el último superadmin activo. Da acceso de superadmin a otra persona antes.',
      ),
    );
  });

  it('a un suspendido se le ofrece reactivar, sin motivo', async () => {
    const { fixture } = await montar();
    dialogs.confirm.mockResolvedValue(true);
    const acciones = await accionesDe(fixture, 2);
    expect(acciones.map((a) => a.label).filter(Boolean)).toEqual([
      'Cambiar rol',
      'Reactivar',
      'Quitar acceso',
    ]);
    acciones.find((a) => a.label === 'Reactivar')!.command!({});
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'PATCH' && r.url === '/platform/staff/caro');
    });
    expect(req.request.body).toEqual({ status: 'ACTIVE' });
  });
});
