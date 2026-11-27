import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { broadcastDraftOf, broadcastsPageOf } from '../data/broadcasts.models';
import { CommunicationsComponent } from './communications.component';

const LLAVE_CRUDA = /\b(comm|nav|common|act)\.[a-zA-Z]/;
const LEER = ['platform:catalogs'];
const GESTIONAR = ['platform:catalogs:manage'];
const BASE = '/platform/communications/broadcasts';

const ACTIVO = {
  id: 'b1',
  title: 'Mantenimiento esta noche',
  message: 'De 10 a 11 p. m.',
  state: 'active',
  createdBy: 'a1',
  createdByName: 'Ada Paz',
  createdAt: '2026-11-27T15:00:00Z',
};
const RETIRADO = {
  ...ACTIVO,
  id: 'b2',
  title: 'Aviso viejo',
  state: 'withdrawn',
  withdrawnBy: 'a2',
  withdrawnByName: 'Luis Gómez',
  withdrawnAt: '2026-11-27T16:00:00Z',
};

describe('broadcastDraftOf y broadcastsPageOf', () => {
  it('limpia el borrador como el core', () => {
    expect(broadcastDraftOf('  Hola   a todos ', ' línea 1  \r\n\r\nlínea 2 \n')).toEqual({
      title: 'Hola a todos',
      message: 'línea 1\n\nlínea 2',
    });
  });

  it('tolera respuestas vacías', () => {
    expect(broadcastsPageOf({})).toEqual({ total: 0, items: [] });
    expect(broadcastsPageOf(null)).toEqual({ total: 0, items: [] });
  });
});

describe('Comunicaciones › Mensaje en vivo', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const destinatarios = () =>
    http.expectOne((req) => req.url.endsWith('/platform/communications/recipients')).flush({ total: 0, items: [] });

  const esHistorial = (req: { method: string; url: string }) => req.method === 'GET' && req.url.endsWith(BASE);
  const historial = () => http.expectOne(esHistorial);
  const historialLuego = async (fixture: ComponentFixture<unknown>) => {
    let peticion: ReturnType<HttpTestingController['match']>[number] | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      [peticion] = http.match(esHistorial);
      expect(peticion).toBeDefined();
    });
    return peticion!;
  };

  const boton = (host: HTMLElement, texto: string): HTMLButtonElement =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;

  const ver = async (fixture: ComponentFixture<unknown>, texto: string): Promise<HTMLElement> => {
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain(texto);
    });
    return host;
  };

  const abrir = (permisos: string[]) => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(CommunicationsComponent);
    fixture.componentRef.setInput('vista', 'en-vivo');
    fixture.detectChanges();
    destinatarios();
    return fixture;
  };

  const escribir = (host: HTMLElement, titulo: string, mensaje: string): void => {
    const campo = host.querySelector('dba-broadcast-composer input') as HTMLInputElement;
    campo.value = titulo;
    campo.dispatchEvent(new Event('input'));
    const area = host.querySelector('dba-broadcast-composer textarea') as HTMLTextAreaElement;
    area.value = mensaje;
    area.dispatchEvent(new Event('input'));
  };

  it('quien solo lee ve el historial con estados, sin redactar ni retirar', async () => {
    const fixture = abrir(LEER);
    const peticion = historial();
    expect(peticion.request.params.get('page')).toBe('1');
    peticion.flush({ total: 2, items: [ACTIVO, RETIRADO] });
    const host = await ver(fixture, 'Mantenimiento esta noche');
    expect(host.textContent).toContain('Activo');
    expect(host.textContent).toContain('Retirado por Luis Gómez');
    expect(host.querySelector('dba-broadcast-composer')).toBeNull();
    expect(boton(host, 'Retirar')).toBeUndefined();
    expect(host.textContent ?? '').not.toMatch(LLAVE_CRUDA);
  });

  it('sin mensajes lo dice y si falla deja reintentar', async () => {
    const fixture = abrir(LEER);
    historial().flush({}, { status: 500, statusText: 'x' });
    const host = await ver(fixture, 'No se pudieron cargar los mensajes');
    boton(host, 'Reintentar').click();
    historial().flush({ total: 0, items: [] });
    await ver(fixture, 'Todavía no hay mensajes en vivo');
  });

  it('la vista previa muestra el texto limpio y publicar pide confirmación', async () => {
    const fixture = abrir(GESTIONAR);
    historial().flush({ total: 0, items: [] });
    const host = await ver(fixture, 'Nuevo mensaje en vivo');
    expect(boton(host, 'Publicar').disabled).toBe(true);

    escribir(host, '  Mantenimiento   esta noche ', 'De 10 a 11 p. m.\n\nGracias  ');
    fixture.detectChanges();
    expect(host.querySelector('dba-broadcast-preview')?.textContent).toContain('Mantenimiento esta noche');
    expect(boton(host, 'Publicar').disabled).toBe(false);

    boton(host, 'Publicar').click();
    fixture.detectChanges();
    expect(host.textContent).toContain('a todos los usuarios conectados de todas las organizaciones');
    boton(host, 'Publicar ahora').click();
    boton(host, 'Publicar ahora').click();

    const envio = http.expectOne((req) => req.method === 'POST' && req.url.endsWith(BASE));
    expect(envio.request.body).toEqual({ title: 'Mantenimiento esta noche', message: 'De 10 a 11 p. m.\n\nGracias' });
    envio.flush(ACTIVO);
    (await historialLuego(fixture)).flush({ total: 1, items: [ACTIVO] });
    await ver(fixture, 'Ada Paz');
    expect((host.querySelector('dba-broadcast-composer input') as HTMLInputElement).value).toBe('');
    expect(host.querySelector('db-modal-shell')).toBeNull();
  });

  it('si el core rechaza la publicación deja la confirmación abierta', async () => {
    const fixture = abrir(GESTIONAR);
    historial().flush({ total: 0, items: [] });
    const host = await ver(fixture, 'Nuevo mensaje en vivo');
    escribir(host, 'Hola', 'Texto');
    fixture.detectChanges();
    boton(host, 'Publicar').click();
    fixture.detectChanges();
    boton(host, 'Publicar ahora').click();
    http
      .expectOne((req) => req.method === 'POST' && req.url.endsWith(BASE))
      .flush({ code: 'MENSAJE_VACIO' }, { status: 400, statusText: 'x' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-modal-shell')).not.toBeNull();
    });
  });

  it('retirar pide confirmación, llama al core y recarga', async () => {
    const fixture = abrir(GESTIONAR);
    historial().flush({ total: 2, items: [ACTIVO, RETIRADO] });
    const host = await ver(fixture, 'Mantenimiento esta noche');
    const retirar = [...host.querySelectorAll('dba-broadcast-history button')].filter((b) => b.textContent?.trim() === 'Retirar');
    expect(retirar).toHaveLength(1);
    (retirar[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Deja de aparecerles a los clientes');
    [...host.querySelectorAll('db-modal-shell button')]
      .find((b) => b.textContent?.trim() === 'Retirar')!
      .dispatchEvent(new Event('click'));
    http.expectOne((req) => req.method === 'POST' && req.url.endsWith(`${BASE}/b1/withdraw`)).flush({ ...ACTIVO, state: 'withdrawn' });
    (await historialLuego(fixture)).flush({ total: 2, items: [{ ...ACTIVO, state: 'withdrawn', withdrawnByName: 'Ada Paz' }, RETIRADO] });
    await ver(fixture, 'Retirado por Ada Paz');
    expect(host.querySelector('db-modal-shell')).toBeNull();
  });
});
