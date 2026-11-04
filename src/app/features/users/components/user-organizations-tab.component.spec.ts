import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { conPermisos, configurar, ficha } from '../pages/users-test-kit';
import { MembershipFormComponent } from './membership-form.component';
import { UserOrganizationsTabComponent } from './user-organizations-tab.component';

describe('Ficha del usuario › Organizaciones', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<UserOrganizationsTabComponent>;
  let cambios: unknown[];

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:clients:manage']);
    cambios = [];
  });

  afterEach(() => http.verify());

  const montar = (user = ficha()): HTMLElement => {
    fixture = TestBed.createComponent(UserOrganizationsTabComponent);
    fixture.componentRef.setInput('user', user);
    fixture.componentInstance.changed.subscribe((value) => cambios.push(value));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const elegir = (key: string, fila = 0): void => {
    const tab = fixture.componentInstance as unknown as {
      acting: { set(value: unknown): void };
      onAction(key: string): void;
    };
    tab.acting.set(ficha().memberships[fila]);
    tab.onAction(key);
  };

  const formulario = (): MembershipFormComponent =>
    fixture.debugElement.query(By.directive(MembershipFormComponent))
      .componentInstance as MembershipFormComponent;

  it('agrega a una organización con el rol elegido y el motivo', async () => {
    const host = montar();
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Agregar a organización'))
      ?.click();
    fixture.detectChanges();
    formulario().submitted.emit({ orgId: 'o9', roleId: 'r9', reason: 'Pedido del cliente' });
    const pedido = http.expectOne('/platform/users/u1/memberships/o9');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({ roleId: 'r9', reason: 'Pedido del cliente' });
    const actualizada = ficha();
    pedido.flush(actualizada);
    await vi.waitFor(() => expect(cambios).toEqual([actualizada]));
  });

  it('nombra el error del último administrador', async () => {
    const error = vi.spyOn(TestBed.inject(NotificationService), 'error');
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Salida',
    });
    montar();
    elegir('remove');
    const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/memberships/o1'));
    expect(pedido.request.method).toBe('DELETE');
    expect(pedido.request.body).toEqual({ reason: 'Salida' });
    pedido.flush({ code: 'ULTIMO_ADMIN' }, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Es el último administrador activo de la organización: asigna a otro primero.',
      ),
    );
    expect(cambios).toEqual([]);
  });

  it('quitar pide escribir el documento del usuario', async () => {
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'cancel' });
    montar();
    elegir('remove');
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0]?.[0].challenge?.identifier).toBe('1032456789');
  });

  it('desactiva con estado 0 y activa con estado 1', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Revisión',
    });
    montar();
    elegir('deactivate', 0);
    const apagar = await vi.waitFor(() => http.expectOne('/platform/users/u1/memberships/o1'));
    expect(apagar.request.body).toEqual({ state: 0, reason: 'Revisión' });
    apagar.flush(ficha());
    await vi.waitFor(() => expect(cambios.length).toBe(1));
    elegir('activate', 1);
    const encender = await vi.waitFor(() => http.expectOne('/platform/users/u1/memberships/o2'));
    expect(encender.request.body).toEqual({ state: 1, reason: 'Revisión' });
    encender.flush(ficha());
    await vi.waitFor(() => expect(cambios.length).toBe(2));
  });

  it('solo una copia duplicada ofrece quitarla, y va por su id', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Limpieza',
    });
    const [primera, segunda] = ficha().memberships;
    const usuario = ficha({
      memberships: [
        { ...primera!, duplicate: true, membershipId: 'm7' },
        { ...segunda!, organizationId: 'o1', duplicate: true, membershipId: 'm8' },
      ],
    });
    montar(usuario);
    const tab = fixture.componentInstance as unknown as {
      acting: { set(value: unknown): void };
      actionItems(): { key: string }[];
      onAction(key: string): void;
    };
    tab.acting.set(ficha().memberships[0]);
    expect(tab.actionItems().map((i) => i.key)).not.toContain('duplicate');
    tab.acting.set(usuario.memberships[1]);
    expect(tab.actionItems().map((i) => i.key)).toContain('duplicate');
    tab.onAction('duplicate');
    const pedido = await vi.waitFor(() =>
      http.expectOne('/platform/users/u1/memberships/o1/duplicates/m8'),
    );
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush(ficha());
    await vi.waitFor(() => expect(cambios.length).toBe(1));
  });
});
