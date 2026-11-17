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
    expect(botones(host).join()).not.toContain('Entrar como este usuario');
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

  describe('entrar como este usuario', () => {
    const pestanaFalsa = () => {
      const pestana = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const abrir = vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window);
      return { pestana, abrir };
    };

    it('abre una pestaña en el clic y la lleva al enlace que da el core, sin diálogo', async () => {
      conPermisos(['platform:clients:manage']);
      const dialogo = vi.spyOn(TestBed.inject(DialogService), 'open');
      const { pestana, abrir } = pestanaFalsa();
      const host = await montar((req) => req.flush(ficha()));

      pulsar(host, 'Entrar como este usuario');
      expect(abrir).toHaveBeenCalledWith('', '_blank');
      const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/support-session'));
      expect(pedido.request.method).toBe('POST');
      expect(pedido.request.body).toEqual({});
      pedido.flush({ url: 'https://app.test/soporte#codigo', expiresAt: '2026-11-17T18:00:00Z' });

      await vi.waitFor(() => expect(pestana.location.href).toBe('https://app.test/soporte#codigo'));
      expect(pestana.opener).toBeNull();
      expect(pestana.close).not.toHaveBeenCalled();
      expect(dialogo).not.toHaveBeenCalled();
    });

    it('si el navegador bloquea la pestaña abre el enlace aparte', async () => {
      conPermisos(['platform:clients:manage']);
      const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
      const host = await montar((req) => req.flush(ficha()));

      pulsar(host, 'Entrar como este usuario');
      const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/support-session'));
      pedido.flush({ url: 'https://app.test/soporte#codigo', expiresAt: '2026-11-17T18:00:00Z' });

      await vi.waitFor(() =>
        expect(abrir).toHaveBeenLastCalledWith(
          'https://app.test/soporte#codigo',
          '_blank',
          'noopener',
        ),
      );
    });

    it('con la cuenta bloqueada el botón está apagado y dice por qué', async () => {
      conPermisos(['platform:clients:manage']);
      const host = await montar((req) => req.flush(ficha({ active: false })));
      const boton = [...host.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Entrar como este usuario'),
      );
      expect(boton?.disabled).toBe(true);
      expect(host.textContent).toContain('Desbloquea la cuenta para entrar como este usuario.');
    });

    it('si el core lo rechaza cierra la pestaña vacía y explica el motivo', async () => {
      conPermisos(['platform:clients:manage']);
      const { pestana } = pestanaFalsa();
      const fallo = vi.spyOn(TestBed.inject(NotificationService), 'error');
      const host = await montar((req) => req.flush(ficha()));

      pulsar(host, 'Entrar como este usuario');
      const pedido = await vi.waitFor(() => http.expectOne('/platform/users/u1/support-session'));
      pedido.flush(
        { message: 'El usuario está bloqueado', code: 'USUARIO_BLOQUEADO' },
        { status: 409, statusText: 'Conflict' },
      );

      await vi.waitFor(() => expect(pestana.close).toHaveBeenCalled());
      expect(fallo).toHaveBeenCalledWith(
        'La cuenta está bloqueada. Desbloquéala para entrar como este usuario.',
      );
      expect(pestana.location.href).toBe('');
    });
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
