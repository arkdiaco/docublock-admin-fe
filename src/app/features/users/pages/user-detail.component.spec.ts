import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UserDetailComponent } from './user-detail.component';
import { configurar, ficha } from './users-test-kit';

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
    expect(host.textContent).toContain('Organizaciones (2)');
    expect(host.textContent).toContain('Notaría Central');
    expect(host.textContent).toContain('Administrador');
    expect(host.textContent).toContain('Regional');
    expect(host.textContent).toContain('ana@notaria.co');
    expect(host.querySelector('a.dba-tr')?.getAttribute('href')).toBe(
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
