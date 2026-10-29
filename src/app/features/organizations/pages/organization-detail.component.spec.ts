import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { By } from '@angular/platform-browser';
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { ResellerPickerComponent } from '../components/reseller-picker.component';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { OrganizationDetailComponent } from './organization-detail.component';
import type { PlatformOrgDetail } from '../data/organizations.models';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const detail = (over: Partial<PlatformOrgDetail> = {}): PlatformOrgDetail => ({
  id: 'org-1',
  businessName: 'Aeropuerto Sierra Norte',
  tributaryNumber: '900123456',
  type: 2,
  countryName: 'Colombia',
  email: 'hola@sierranorte.aero',
  countryId: '65a0000000000000000000c0',
  cityId: 'city-bog',
  cityName: 'Bogotá',
  language: 'es',
  state: 'active',
  isReseller: false,
  isTest: true,
  createdAt: '2024-03-14T00:00:00.000Z',
  plan: { code: 'CORP', name: 'Corporativo', source: 'MANUAL', periodStart: '2024-01-01T00:00:00.000Z', periodEnd: '2027-01-01T00:00:00.000Z' },
  documents: { used: 190, limit: 200 },
  members: 48,
  modules: ['pagares', 'bienes_raices'],
  ...over,
});

describe('OrganizationDetailComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = async (body = detail()) => {
    const fixture = TestBed.createComponent(OrganizationDetailComponent);
    fixture.componentRef.setInput('id', 'org-1');
    fixture.detectChanges();
    http.expectOne('/platform/organizations/org-1').flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('pinta la cabecera con nombre, estado y meta, y las nueve pestañas con Resumen activa', async () => {
    const { host } = await montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Aeropuerto Sierra Norte');
    expect(host.querySelector('.rec__card .st--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('900123456');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('Corporativo');
    expect(host.querySelectorAll('db-underline-tabs .tab').length).toBe(9);
    expect(host.querySelector('.tab--on')?.textContent).toContain('Resumen');
    expect(host.querySelector('dba-org-flag .flag--test')?.textContent).toContain('PRUEBA');
  });

  it('el Resumen trae perfil, módulos contratados y el plan con su consumo', async () => {
    const { host } = await montar();
    expect(host.querySelector('.od__dl')?.textContent).toContain('900123456');
    expect(host.querySelector('.od__dl')?.textContent).toContain('Colombia');
    const switches = [...host.querySelectorAll('[role="switch"]')].map((s) => s.getAttribute('aria-checked'));
    expect(switches).toEqual(['true', 'false', 'true']);
    expect(host.querySelector('dba-quota-bar')?.textContent).toContain('190 / 200');
    expect(host.textContent).not.toMatch(/\b(orgd|org|nav|common)\.[a-zA-Z]/);
  });

  it('cambiar de pestaña muestra el placeholder honesto', async () => {
    const { fixture, host } = await montar();
    host.querySelectorAll<HTMLButtonElement>('db-underline-tabs .tab')[6].click();
    fixture.detectChanges();
    expect(host.querySelector('dba-empty-state')?.textContent).toContain('llega pronto');
    expect(host.querySelector('.od__cols')).toBeNull();
  });

  it('sin suscripción lo dice y no pinta el plan', async () => {
    const { host } = await montar(detail({ state: 'no_subscription', plan: undefined, documents: { used: 0, limit: null } }));
    expect(host.querySelector('.od__muted')?.textContent).toContain('Sin suscripción');
    expect(host.querySelector('dba-quota-bar')).toBeNull();
    expect(host.querySelector('.rec__card .st--closed')).not.toBeNull();
  });

  const conPermisos = (permisos: string[]) =>
    TestBed.inject(AuthStore).setProfile({
      user: { id: 'u1', names: 'Marta', surNames: 'Vidal', email: 'marta@docublock.co', identification: '', imageProfile: null },
      platformStaff: true,
      platformPermissions: permisos,
    });

  it('sin platform:clients:manage no ofrece editar', async () => {
    conPermisos(['platform:clients']);
    const { host } = await montar();
    expect([...host.querySelectorAll('button[dba-button]')].some((b) => b.textContent?.includes('Editar'))).toBe(false);
    expect(host.querySelector('.od__dl')?.textContent).toContain('Bogotá');
    expect(host.querySelector('.od__dl')?.textContent).toContain('Español');
  });

  it('editar manda solo lo que cambió y la ficha queda con la respuesta', async () => {
    conPermisos(['platform:clients', 'platform:clients:manage']);
    const { fixture, host } = await montar();
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) => b.textContent?.includes('Editar'))!.click();
    fixture.detectChanges();
    http.expectOne((r) => r.url.startsWith('/catalogs/countries/65a0000000000000000000c0/cities')).flush([
      { id: 'city-bog', name: 'Bogotá' },
      { id: 'city-med', name: 'Medellín' },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    const guardar = () => host.querySelector<HTMLButtonElement>('dba-org-profile-form .foot__go')!;
    expect(guardar().disabled).toBe(true);
    const nombre = host.querySelector<HTMLInputElement>('dba-org-profile-form .field__input')!;
    nombre.value = 'Aeropuerto Sierra Norte S.A.S.';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(guardar().disabled).toBe(false);
    guardar().click();
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url === '/platform/organizations/org-1');
    expect(req.request.body).toEqual({ businessName: 'Aeropuerto Sierra Norte S.A.S.' });
    req.flush(detail({ businessName: 'Aeropuerto Sierra Norte S.A.S.' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('dba-org-profile-form')).toBeNull();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Aeropuerto Sierra Norte S.A.S.');
  });

  it('un NIT de otra organización deja el formulario abierto con el aviso', async () => {
    conPermisos(['platform:clients', 'platform:clients:manage']);
    const { fixture, host } = await montar();
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) => b.textContent?.includes('Editar'))!.click();
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/cities')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    const nit = host.querySelectorAll<HTMLInputElement>('dba-org-profile-form .field__input')[1];
    nit.value = '800987654';
    nit.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('dba-org-profile-form .foot__go')!.click();
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush({ code: 'NIT_EN_USO', message: 'x' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('dba-org-profile-form')).not.toBeNull();
    expect(avisos.mock.calls.map(([m]) => m.detail)).toEqual(['Ya existe otra organización con ese número tributario.']);
  });

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) => b.textContent?.trim() === texto);

  it('suspender pide motivo y escribir el NIT, y la ficha pasa a suspendida con Reactivar', async () => {
    conPermisos(['platform:clients', 'platform:clients:manage']);
    const { fixture, host } = await montar();
    const abrir = vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({ answer: 'confirm', reason: 'Impago de 45 días' });
    boton(host, 'Suspender')!.click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    const pedido = abrir.mock.calls[0][0];
    expect(pedido.challenge?.identifier).toBe('900123456');
    expect(pedido.reason?.required).toBe(true);
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url === '/platform/organizations/org-1/suspend');
    });
    expect(req.request.body).toEqual({ reason: 'Impago de 45 días' });
    req.flush(detail({ state: 'suspended' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(boton(host, 'Reactivar')).toBeDefined();
    expect(boton(host, 'Suspender')).toBeUndefined();
  });

  it('activar un módulo manda la lista completa y lo deja encendido', async () => {
    conPermisos(['platform:clients', 'platform:clients:manage']);
    const { fixture, host } = await montar();
    const switches = host.querySelectorAll<HTMLButtonElement>('[role="switch"]');
    expect(switches[1].disabled).toBe(false);
    switches[1].click();
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url === '/platform/organizations/org-1/modules');
    expect(req.request.body).toEqual({ modules: ['pagares', 'bienes_raices', 'consentimiento_informado'] });
    req.flush({});
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelectorAll('[role="switch"]')[1].getAttribute('aria-checked')).toBe('true');
  });

  it('sin :manage los módulos quedan de solo lectura y no se ofrece cambiar reseller', async () => {
    conPermisos(['platform:clients']);
    const { host } = await montar();
    expect(host.querySelector<HTMLButtonElement>('[role="switch"]')!.disabled).toBe(true);
    expect(host.querySelector('.od__link')).toBeNull();
    expect(boton(host, 'Suspender')).toBeUndefined();
  });

  it('asignar reseller guarda y recarga la ficha con su nombre', async () => {
    conPermisos(['platform:clients', 'platform:commercial', 'platform:commercial:manage']);
    const { fixture, host } = await montar();
    expect(host.querySelector('.od__reseller')?.textContent).toContain('Sin reseller');
    host.querySelector<HTMLButtonElement>('.od__link')!.click();
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/platform/resellers').flush({ total: 1, items: [{ id: 'r1', businessName: 'Canal Andino', tributaryNumber: '901' }] });
    await fixture.whenStable();
    fixture.debugElement.query(By.directive(ResellerPickerComponent)).componentInstance.submitted.emit('r1');
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/platform/organizations/org-1/reseller');
    expect(put.request.body).toEqual({ resellerId: 'r1' });
    put.flush({});
    await vi.waitFor(() => http.expectOne('/platform/organizations/org-1').flush(detail({ resellerId: 'r1', resellerName: 'Canal Andino' })));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('dba-reseller-picker')).toBeNull();
    expect(host.querySelector('.od__reseller')?.textContent).toContain('Canal Andino');
  });
});
