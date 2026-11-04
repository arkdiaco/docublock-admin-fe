import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { conPermisos, configurar } from '../pages/users-test-kit';
import { UserHistoryTabComponent } from './user-history-tab.component';
import { UserPasskeysTabComponent } from './user-passkeys-tab.component';
import { UserSessionsTabComponent } from './user-sessions-tab.component';

describe('Ficha del usuario › Sesiones, llaves e historial', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<UserSessionsTabComponent>;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const sesiones = async (permisos: string[]) => {
    conPermisos(permisos);
    fixture = TestBed.createComponent(UserSessionsTabComponent);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.componentRef.setInput('userName', 'Ana Pérez');
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne('/platform/users/u1/sessions')
      .flush([{ sid: 's1', device: 'Chrome en Mac', ip: '10.0.0.1' }]);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Chrome en Mac');
    });
    return host;
  };

  const pulsar = (host: HTMLElement, texto: string): void => {
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))?.click();
  };

  it('sin permiso de administrar las sesiones se ven pero no se cierran', async () => {
    const host = await sesiones(['platform:clients:read']);
    expect(host.querySelector('button')).toBeNull();
  });

  it('cerrar una sesión manda el motivo y recarga', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Equipo perdido',
    });
    const host = await sesiones(['platform:clients:manage']);
    pulsar(host, 'Cerrar sesión');
    const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/sessions/s1'));
    expect(pedido.request.method).toBe('DELETE');
    expect(pedido.request.body).toEqual({ reason: 'Equipo perdido' });
    pedido.flush({ revoked: true });
    const recarga = await vi.waitFor(() => http.expectOne('/platform/users/u1/sessions'));
    recarga.flush([]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('No tiene sesiones activas.');
    });
  });

  it('cerrar todas va a la ruta general', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Fraude',
    });
    const host = await sesiones(['platform:clients:manage']);
    pulsar(host, 'Cerrar todas');
    const pedido = await vi.waitFor(() =>
      http.expectOne((req) => req.method === 'DELETE' && req.url === '/platform/users/u1/sessions'),
    );
    pedido.flush({ revoked: 1 });
    const recarga = await vi.waitFor(() =>
      http.expectOne((req) => req.method === 'GET' && req.url === '/platform/users/u1/sessions'),
    );
    recarga.flush([]);
  });

  it('revocar una llave manda el motivo', async () => {
    conPermisos(['platform:clients:manage']);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Llave perdida',
    });
    const fixture = TestBed.createComponent(UserPasskeysTabComponent);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.componentRef.setInput('userName', 'Ana Pérez');
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne('/platform/users/u1/passkeys')
      .flush([{ credentialId: 'c/1', deviceName: 'iPhone', backedUp: true }]);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('iPhone');
    });
    pulsar(host, 'Revocar');
    const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/passkeys/c%2F1'));
    expect(pedido.request.body).toEqual({ reason: 'Llave perdida' });
    pedido.flush({ revoked: true });
    const recarga = await vi.waitFor(() => http.expectOne('/platform/users/u1/passkeys'));
    recarga.flush([]);
  });

  it('el historial pide los eventos del usuario y los nombra sin llaves crudas', async () => {
    const fixture = TestBed.createComponent(UserHistoryTabComponent);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.detectChanges();
    await fixture.whenStable();
    const pedido = http.expectOne((req) => req.url === '/platform/audit');
    expect(pedido.request.params.get('targetType')).toBe('user');
    expect(pedido.request.params.get('targetId')).toBe('u1');
    pedido.flush({
      total: 1,
      items: [
        {
          id: 'e1',
          action: 'users.membership_add',
          admin: { id: 'a1', name: 'Sam' },
          organization: { id: 'o1', name: 'Notaría Central' },
          reason: 'Pedido',
          createdAt: '2026-11-03T12:00:00.000Z',
        },
      ],
    });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('agregó a una persona a Notaría Central');
    });
    expect(host.textContent).toContain('«Pedido»');
    expect(host.textContent).not.toContain('act.users');
  });
});
