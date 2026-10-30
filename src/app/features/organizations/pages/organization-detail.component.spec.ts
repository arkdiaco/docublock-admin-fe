import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  it('pinta la cabecera con nombre, estado y meta, y siete pestañas con Resumen activa (sin Auditoría ni Marketplace si no lee plataforma ni comercial)', async () => {
    const { host } = await montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Aeropuerto Sierra Norte');
    expect(host.querySelector('.rec__card .st--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('900123456');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('Corporativo');
    expect(host.querySelectorAll('db-underline-tabs .tab').length).toBe(7);
    expect(host.querySelector('db-underline-tabs')?.textContent).not.toContain('Auditoría');
    expect(host.querySelector('db-underline-tabs')?.textContent).not.toContain('Marketplace');
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

  it('purgar datos de prueba solo aparece con platform:platform:manage y en organizaciones de prueba', async () => {
    conPermisos(['platform:clients', 'platform:clients:manage']);
    const sinPermiso = await montar();
    expect(boton(sinPermiso.host, 'Purgar datos de prueba')).toBeUndefined();
    sinPermiso.fixture.destroy();

    conPermisos(['platform:platform', 'platform:platform:manage']);
    const real = await montar(detail({ isTest: false }));
    expect(boton(real.host, 'Purgar datos de prueba')).toBeUndefined();
  });

  it('la vista previa de la purga muestra lo que borraría y lo que queda, y ofrece continuar', async () => {
    conPermisos(['platform:platform', 'platform:platform:manage']);
    const { fixture, host } = await montar();
    boton(host, 'Purgar datos de prueba')!.click();
    fixture.detectChanges();
    http.expectOne((r) => r.method === 'GET' && r.url === '/platform/organizations/org-1/purge/preview').flush({
      organizationId: 'org-1',
      businessName: 'Aeropuerto',
      tributaryNumber: '900123456',
      total: 9,
      groups: [
        { group: 'operation', total: 7, targets: [{ collection: 'documents', mode: 'delete', count: 7 }, { collection: 'flows', mode: 'delete', count: 0 }] },
        { group: 'consumption', total: 0, targets: [] },
        { group: 'membership', total: 2, targets: [{ collection: 'users', mode: 'pull', count: 2 }] },
      ],
      kept: ['organization', 'audit'],
      previewToken: 'f'.repeat(64),
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const modal = host.querySelector('dba-org-purge')!;
    const filas = [...modal.querySelectorAll('.pp__row')].map((r) =>
      [...r.querySelectorAll('.pp__name > span, .pp__count')].map((part) => part.textContent?.trim()),
    );
    expect(filas).toEqual([
      ['Documentos', 'documents', '7'],
      ['Usuarios miembros', 'users', '2'],
    ]);
    expect(modal.querySelector('.pp__none')?.textContent).toContain('Nada que purgar');
    expect(modal.querySelector('.pp__kept')?.textContent).toContain('Bitácoras y auditoría');
    expect(modal.textContent).not.toMatch(/purge\./);
    expect(modal.querySelector('.foot__go')?.textContent?.trim()).toBe('Continuar a purgar');
    modal.querySelector<HTMLButtonElement>('.foot__ghost')!.click();
    fixture.detectChanges();
    expect(host.querySelector('dba-org-purge')).toBeNull();
  });

  it('si la organización dejó de ser de prueba, la vista previa lo explica', async () => {
    conPermisos(['platform:platform', 'platform:platform:manage']);
    const { fixture, host } = await montar();
    boton(host, 'Purgar datos de prueba')!.click();
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/purge/preview'))
      .flush({ code: 'PURGA_SOLO_PRUEBAS', message: 'x' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('dba-org-purge dba-empty-state')?.textContent).toContain('Solo se purgan organizaciones marcadas como de prueba.');
  });

  it('con lectura comercial la pestaña Marketplace carga precios y add-ons de la organización', async () => {
    conPermisos(['platform:clients', 'platform:commercial']);
    const { fixture, host } = await montar();
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('db-underline-tabs .tab')];
    tabs.find((t) => t.textContent?.includes('Marketplace'))!.click();
    fixture.detectChanges();
    http.expectOne('/platform/marketplace/organizations/org-1/prices').flush([]);
    http.expectOne('/platform/marketplace/organizations/org-1/addons').flush([]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-org-marketplace-tab')?.textContent).toContain('No hay add-ons disponibles');
    });
  });

  it('con lectura de plataforma la pestaña Auditoría muestra la actividad de la organización y enlaza a la bitácora filtrada', async () => {
    conPermisos(['platform:clients', 'platform:platform']);
    const { fixture, host } = await montar();
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('db-underline-tabs .tab')];
    expect(tabs.length).toBe(8);
    tabs.find((t) => t.textContent?.includes('Auditoría'))!.click();
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/platform/audit');
    expect(req.request.params.get('organizationId')).toBe('org-1');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({
      total: 21,
      items: [
        {
          id: 'e1',
          action: 'organization.suspend',
          admin: { id: 'a1', name: 'Marta Vidal', email: 'marta@docublock.co' },
          target: { type: 'organization', id: 'org-1' },
          reason: 'Impago',
          createdAt: '2026-10-29T15:00:00.000Z',
        },
        {
          id: 'e2',
          action: 'organization.update',
          admin: { id: 'a2', email: 'lucia.paredes@docublock.co' },
          target: { type: 'organization', id: 'org-1' },
          createdAt: '2026-10-28T15:00:00.000Z',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const tab = host.querySelector('dba-org-audit-tab')!;
    const eventos = [...tab.querySelectorAll('dba-audit-event')].map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
    expect(eventos[0]).toContain('Marta Vidal');
    expect(eventos[0]).toContain('organization.suspend');
    expect(eventos[0]).toContain('«Impago»');
    expect(eventos[1]).toContain('lucia.paredes');
    expect(tab.textContent).toContain('2 de 21 eventos');
    expect(tab.querySelector('a')?.getAttribute('href')).toBe('/plataforma/auditoria?filtro=org:org-1');
    expect(tab.textContent).not.toMatch(/orgAudit\./);

    [...tab.querySelectorAll<HTMLButtonElement>('button[dba-button]')].find((b) => b.textContent?.includes('Cargar más'))!.click();
    const mas = http.expectOne((r) => r.url === '/platform/audit' && r.params.get('page') === '2');
    mas.flush({ total: 21, items: [] });
  });

  it('con ?tab=subscription abre directo la pestaña Suscripción', async () => {
    await TestBed.inject(Router).navigateByUrl('/?tab=subscription');
    const fixture = TestBed.createComponent(OrganizationDetailComponent);
    fixture.componentRef.setInput('id', 'org-1');
    fixture.detectChanges();
    http.expectOne('/platform/organizations/org-1').flush(detail());
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.tab--on')?.textContent).toContain('Suscripción');
    http.expectOne('/platform/organizations/org-1/subscription').flush({ current: null, history: [], plans: [], mirror: null });
  });

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
