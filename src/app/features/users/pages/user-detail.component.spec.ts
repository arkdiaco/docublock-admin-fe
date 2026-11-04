import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { UserDetailComponent } from './user-detail.component';
import { conPermisos, configurar, ficha } from './users-test-kit';

describe('Clientes › Ficha del usuario', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (
    responder: (req: ReturnType<HttpTestingController['expectOne']>) => void,
  ) => {
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.componentRef.setInput('id', 'u1');
    fixture.detectChanges();
    responder(http.expectOne('/platform/users/u1'));
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-section-loader')).toBeNull();
    });
    return host;
  };

  it('pinta datos y expedición legibles', async () => {
    const host = await montar((req) => req.flush(ficha()));
    expect(host.textContent).toContain('Ana Pérez Gómez');
    expect(host.textContent).toContain('Cédula de ciudadanía · 1032456789');
    expect(host.textContent).toContain('Bogotá');
    expect(host.textContent).toContain('Medellín · 20/05/2010');
    expect(host.textContent).toContain('Aceptados');
  });

  it('una fecha de expedición que no es ISO se muestra tal cual sin romper', async () => {
    const host = await montar((req) => req.flush(ficha({ expeditionDate: '20 de mayo' })));
    expect(host.textContent).toContain('Medellín · 20 de mayo');
  });

  it('lista organizaciones con enlace, rol, rama y contacto de la membresía', async () => {
    const host = await montar((req) => req.flush(ficha()));
    expect(host.textContent).toContain('Organizaciones');
    expect(host.textContent).toContain('Notaría Central');
    expect(host.textContent).toContain('Administrador');
    expect(host.textContent).toContain('Regional');
    expect(host.textContent).toContain('ana@notaria.co');
    expect(host.querySelector('.dba-tr a')?.getAttribute('href')).toBe(
      '/clientes/organizaciones/o1',
    );
  });

  it('nombra lo que falta en una membresía incompleta y marca la cuenta personal', async () => {
    const host = await montar((req) => req.flush(ficha()));
    expect(host.textContent).toContain('Organización no disponible');
    expect(host.textContent).toContain('Sin rol reconocido');
    expect(host.textContent).toContain('Cuenta personal');
    expect(host.textContent).toContain('Inactivo');
  });

  it('sin organizaciones lo dice en lugar de pintar una tabla vacía', async () => {
    const host = await montar((req) => req.flush(ficha({ memberships: [] })));
    expect(host.querySelector('dba-data-table')).toBeNull();
    expect(host.textContent).toContain('No pertenece a ninguna organización.');
  });

  const botones = (host: HTMLElement): string[] =>
    [...host.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');

  const pulsar = (host: HTMLElement, texto: string): void => {
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))?.click();
  };

  it('sin permiso de administrar no pinta ninguna acción', async () => {
    conPermisos(['platform:clients:read']);
    const host = await montar((req) => req.flush(ficha()));
    expect(botones(host).join()).not.toContain('Editar datos');
    expect(botones(host).join()).not.toContain('Bloquear cuenta');
    expect(botones(host).join()).not.toContain('Agregar a organización');
    expect(host.querySelector('.uo__more')).toBeNull();
  });

  it('con permiso de administrar pinta las acciones y sin plataforma oculta el historial', async () => {
    conPermisos(['platform:clients:manage']);
    const host = await montar((req) => req.flush(ficha()));
    expect(botones(host).join()).toContain('Editar datos');
    expect(botones(host).join()).toContain('Bloquear cuenta');
    expect(botones(host).join()).toContain('Agregar a organización');
    expect(host.querySelectorAll('.uo__more').length).toBe(2);
    expect(host.textContent).not.toContain('Historial');
  });

  it('bloquear exige motivo, recarga la ficha y avisa de las sesiones cerradas', async () => {
    conPermisos(['platform:clients:manage']);
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Fraude' });
    const exito = vi.spyOn(TestBed.inject(NotificationService), 'success');
    const host = await montar((req) => req.flush(ficha()));
    pulsar(host, 'Bloquear cuenta');
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/block'));
    expect(pedido.request.body).toEqual({ reason: 'Fraude' });
    pedido.flush({ active: false, revokedSessions: 2 });
    const ficha2 = await vi.waitFor(() => http.expectOne('/platform/users/u1'));
    ficha2.flush(ficha({ active: false }));
    await vi.waitFor(() =>
      expect(exito).toHaveBeenCalledWith('Cuenta bloqueada. Sesiones cerradas: 2.'),
    );
    expect(abrir.mock.calls[0]?.[0].reason?.required).toBe(true);
  });

  it('si se cancela el diálogo no bloquea', async () => {
    conPermisos(['platform:clients:manage']);
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'cancel' });
    const host = await montar((req) => req.flush(ficha()));
    pulsar(host, 'Bloquear cuenta');
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    http.expectNone('/platform/users/u1/block');
  });

  it('un 404 lleva al estado de no encontrado', async () => {
    const host = await montar((req) => req.flush({}, { status: 404, statusText: 'No' }));
    expect(host.textContent).toContain('Este usuario no existe.');
    expect(host.querySelector('a[dba-button]')?.getAttribute('href')).toBe('/clientes/usuarios');
  });

  it('un error de servidor ofrece reintentar', async () => {
    const host = await montar((req) => req.flush({}, { status: 500, statusText: 'Error' }));
    expect(host.textContent).toContain('No pudimos cargar el usuario.');
    expect(host.querySelector('button[dba-button]')).not.toBeNull();
  });
});
