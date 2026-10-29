import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../../public/i18n/es.json';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DialogService } from '../../../../core/ui/dialog.service';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import type { OrgInvitation, OrgMember, OrgRole } from '../../data/members.models';
import { InviteMemberFormComponent } from './invite-member-form.component';
import { MembersTabComponent } from './members-tab.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const ORG = {
  id: 'org-1',
  businessName: 'Sierra Norte',
  tributaryNumber: '900123456',
} as PlatformOrgDetail;

const ROLES: OrgRole[] = [
  {
    id: 'r-admin',
    name: 'Administrador',
    code: 1,
    description: '',
    isSystem: true,
    permissions: 40,
  },
  { id: 'r-op', name: 'Operador', code: 2, description: '', isSystem: true, permissions: 12 },
];

const ANA: OrgMember = {
  userId: 'u1',
  names: 'Ana',
  surNames: 'Pérez',
  identification: '1032',
  email: 'ana@sierra.co',
  state: 1,
  roleId: 'r-admin',
  roleName: 'Administrador',
};

const INV: OrgInvitation = {
  id: 'i1',
  identification: '5544',
  email: 'nuevo@sierra.co',
  roleId: 'r-op',
  state: 'PENDING',
  expiresAt: '2026-11-03T00:00:00.000Z',
};

describe('MembersTabComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersTabComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
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

  const responder = (members: OrgMember[] = [ANA]) => {
    http
      .expectOne((r) => r.url === '/platform/organizations/org-1/members')
      .flush({ total: members.length, items: members });
    http
      .expectOne((r) => r.url === '/platform/organizations/org-1/invitations')
      .flush({ total: 1, items: [INV] });
    http.expectOne('/platform/organizations/org-1/roles').flush(ROLES);
  };

  const montar = async (permisos: string[] = ['platform:clients', 'platform:clients:manage']) => {
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'x',
        names: 'Marta',
        surNames: 'Vidal',
        email: 'm@d.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });
    const fixture = TestBed.createComponent(MembersTabComponent);
    fixture.componentRef.setInput('org', ORG);
    fixture.detectChanges();
    responder();
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.mt__name')).not.toBeNull();
    });
    return { fixture, host };
  };

  it('pinta miembros con rol y estado, e invitaciones con el nombre del rol', async () => {
    const { host } = await montar();
    expect(host.textContent).toContain('Miembros (1)');
    expect(host.querySelector('.mt__name')?.textContent).toContain('Ana Pérez');
    expect(host.textContent).toContain('Administrador');
    expect(host.textContent).toContain('nuevo@sierra.co');
    expect(host.textContent).toContain('Operador');
    expect(host.textContent).toContain('Pendiente');
    expect(host.textContent).not.toMatch(/\b(members|common|tbl)\.[a-zA-Z]/);
  });

  it('sin clients:manage no hay acciones', async () => {
    const { host } = await montar(['platform:clients']);
    expect(host.querySelector('.mt__more')).toBeNull();
    expect(host.querySelector('.mt__link')).toBeNull();
    expect(
      [...host.querySelectorAll('button[dba-button]')].some((b) =>
        b.textContent?.includes('Invitar'),
      ),
    ).toBe(false);
  });

  it('invitar propone Administrador y manda la invitación', async () => {
    const { fixture, host } = await montar();
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')]
      .find((b) => b.textContent?.trim() === 'Invitar')!
      .click();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(InviteMemberFormComponent))
      .componentInstance as unknown as {
      roleId: () => string;
      submitted: { emit: (v: unknown) => void };
    };
    expect(form.roleId()).toBe('r-admin');
    form.submitted.emit({
      identification: '7788',
      email: 'jefe@sierra.co',
      roleId: 'r-admin',
      reason: 'Alta del cliente',
    });
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/invitations'));
    expect(req.request.body).toEqual({
      identification: '7788',
      email: 'jefe@sierra.co',
      roleId: 'r-admin',
      reason: 'Alta del cliente',
    });
    req.flush(INV);
    await vi.waitFor(() => responder());
  });

  it('quitar pide escribir la identificación y un último admin se dice en pantalla', async () => {
    const { fixture, host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Salió' });
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    host.querySelector<HTMLButtonElement>('.mt__more')!.click();
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { onAction: (k: string) => void }).onAction('remove');
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].challenge?.identifier).toBe('1032');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/members/u1'));
    });
    expect(req.request.body).toEqual({ reason: 'Salió' });
    req.flush({ code: 'ULTIMO_ADMIN', message: 'x' }, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() =>
      expect(avisos).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'Es el último administrador activo: asigna otro antes.',
        }),
      ),
    );
  });

  it('sincronizar roles pide motivo y muestra el reporte', async () => {
    const { host } = await montar();
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Permisos nuevos',
    });
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')]
      .find((b) => b.textContent?.includes('Sincronizar roles'))!
      .click();
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/roles/sync'));
    });
    req.flush({ created: 1, existing: 4, rolesWithDerived: 3 });
    await vi.waitFor(() => responder());
    await vi.waitFor(() =>
      expect(avisos).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'Roles sincronizados: 1 creados, 3 con permisos nuevos',
        }),
      ),
    );
  });
});
