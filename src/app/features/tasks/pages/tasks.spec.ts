import { HttpErrorResponse } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { isQueueKey, kindKeyOf, noRetryKeyOf, statePills } from '../data/queue-view';
import { retryErrorKey } from '../data/tasks.api';
import type { QueueItem, QueueItemsPage, QueueSummary } from '../data/tasks.models';
import { QueueDetailComponent } from './queue-detail.component';
import { TasksComponent } from './tasks.component';

const LLAVE_CRUDA = /\b(task|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/tasks/queues';

const COLAS: QueueSummary[] = [
  {
    key: 'closing',
    counts: { failed: 2, pending: 1, running: 0 },
    oldestPendingAt: '2026-11-01T10:00:00.000Z',
  },
  {
    key: 'seals',
    counts: { failed: null, pending: 0, running: null },
    oldestPendingAt: null,
  },
];

const PAGINA: QueueItemsPage = {
  key: 'closing',
  state: 'failed',
  counts: { failed: 1, pending: 3, running: 0 },
  total: 1,
  items: [
    {
      id: 't1',
      state: 'failed',
      organization: { id: 'o1', name: 'Acme SAS' },
      label: 'Contrato de arriendo',
      kind: null,
      attempts: 6,
      error: 'El cofre no respondió',
      nextAt: '2026-11-01T10:00:00.000Z',
      retryable: true,
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
  ],
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

describe('vista de las colas', () => {
  it('reconoce solo las colas que existen', () => {
    expect(isQueueKey('closing')).toBe(true);
    expect(isQueueKey('otra')).toBe(false);
  });

  it('solo traduce los tipos conocidos', () => {
    expect(kindKeyOf('API_KEY')).toBe('task.kind.API_KEY');
    expect(kindKeyOf('NUEVO')).toBeNull();
  });

  it('no pinta filtros de los estados que la cola no tiene', () => {
    const pills = statePills({ failed: null, pending: 2, running: null });
    expect(pills.map((pill) => pill.key)).toEqual(['pending']);
  });

  it('marca los fallidos solo cuando hay', () => {
    const [conFallos] = statePills({ failed: 1, pending: 0, running: 0 });
    const [sinFallos] = statePills({ failed: 0, pending: 0, running: 0 });
    expect(conFallos.danger).toBe(true);
    expect(sinFallos.danger).toBeUndefined();
  });
});

describe('reintento', () => {
  const fila = PAGINA.items[0];

  it('explica por qué una purga o un canal no se reintentan', () => {
    const fija: QueueItem = { ...fila, retryable: false };
    expect(noRetryKeyOf('purge', fija)).toBe('task.noRetry.purge');
    expect(noRetryKeyOf('notifications', fija)).toBe('task.noRetry.channel');
    expect(noRetryKeyOf('notifications', fila)).toBeNull();
    expect(noRetryKeyOf('purge', { ...fija, state: 'running' })).toBeNull();
  });

  it('traduce el error del servidor', () => {
    const conEstado = (status: number) => new HttpErrorResponse({ status });
    expect(retryErrorKey(conEstado(409))).toBe('task.retry.gone');
    expect(retryErrorKey(conEstado(403))).toBe('task.retry.forbidden');
    expect(retryErrorKey(conEstado(500))).toBe('task.retry.failed');
  });
});

describe('Tareas', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:operations']);
  });

  afterEach(() => http.verify());

  it('resume cada cola y deja una raya donde el estado no aplica', async () => {
    const fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
    http.expectOne(BASE).flush({ queues: COLAS });
    await asentar(fixture);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Cierre de documentos');
    expect(texto).toContain('Sellos de títulos');
    expect(texto).toContain('—');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('a.dba-tr')).toHaveLength(2);
  });

  it('si el servidor falla ofrece reintentar', async () => {
    const fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
    http.expectOne(BASE).flush(null, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    const botones = [...host.querySelectorAll('button')];
    const reintentar = botones.find((boton) => boton.textContent?.includes('Reintentar'));
    reintentar?.click();
    http.expectOne(BASE).flush({ queues: COLAS });
    await asentar(fixture);
    expect(host.textContent).toContain('Cierre de documentos');
  });

  it('actualizar conserva la tabla a la vista', async () => {
    const fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
    http.expectOne(BASE).flush({ queues: COLAS });
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const actualizar = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Actualizar'));
    actualizar?.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('a.dba-tr')).toHaveLength(2);
    http.expectOne(BASE).flush({ queues: COLAS });
    await asentar(fixture);
  });
});

describe('Detalle de una cola', () => {
  let http: HttpTestingController;

  const abrir = (cola: string): ComponentFixture<QueueDetailComponent> => {
    const fixture = TestBed.createComponent(QueueDetailComponent);
    fixture.componentRef.setInput('queue', cola);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:operations', 'platform:clients']);
  });

  afterEach(() => http.verify());

  it('deja al servidor elegir el estado inicial y lo marca', async () => {
    const fixture = abrir('closing');
    const peticion = http.expectOne((r) => r.url === `${BASE}/closing/items`);
    expect(peticion.request.params.has('state')).toBe(false);
    peticion.flush(PAGINA);
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Acme SAS');
    expect(host.textContent).toContain('El cofre no respondió');
    expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    const activo = host.querySelector('.pill--on');
    expect(activo?.textContent).toContain('Fallidos');
  });

  it('cambia de estado desde los filtros', async () => {
    const fixture = abrir('closing');
    http.expectOne((r) => r.url === `${BASE}/closing/items`).flush(PAGINA);
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const pendientes = [...host.querySelectorAll<HTMLButtonElement>('.pill')].find((pill) =>
      pill.textContent?.includes('Pendientes'),
    );
    pendientes?.click();
    const peticion = http.expectOne((r) => r.url === `${BASE}/closing/items`);
    expect(peticion.request.params.get('state')).toBe('pending');
    peticion.flush({ ...PAGINA, state: 'pending', total: 0, items: [] });
    await asentar(fixture);
    expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    expect(host.textContent).not.toContain('Acme SAS');
  });

  it('actualizar conserva la tabla y un fallo se ve con opción de reintentar', async () => {
    const fixture = abrir('closing');
    http.expectOne((r) => r.url === `${BASE}/closing/items`).flush(PAGINA);
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const actualizar = () =>
      [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Actualizar');
    actualizar()?.click();
    expect(host.textContent).toContain('Acme SAS');
    http.expectOne((r) => r.url === `${BASE}/closing/items`).flush(PAGINA);
    await asentar(fixture);
    actualizar()?.click();
    http
      .expectOne((r) => r.url === `${BASE}/closing/items`)
      .flush({}, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    expect(host.textContent).not.toContain('Acme SAS');
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('button')].some((b) => b.textContent?.trim() === 'Reintentar'),
    ).toBe(true);
  });

  it('abre el error completo al elegir una fila', async () => {
    const fixture = abrir('closing');
    http.expectOne((r) => r.url === `${BASE}/closing/items`).flush(PAGINA);
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button.dba-tr')?.click();
    await asentar(fixture);
    expect(host.querySelector('pre')?.textContent).toContain('El cofre no respondió');
    expect(host.querySelector('dba-queue-item-detail a')?.textContent).toContain('Acme SAS');
    expect(host.textContent).not.toMatch(LLAVE_CRUDA);
  });

  it('sin permiso sobre organizaciones no ofrece el enlace', async () => {
    conPermisos(['platform:operations']);
    const fixture = abrir('closing');
    http.expectOne((r) => r.url === `${BASE}/closing/items`).flush(PAGINA);
    await asentar(fixture);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button.dba-tr')?.click();
    await asentar(fixture);
    expect(host.querySelector('dba-queue-item-detail a')).toBeNull();
    expect(host.querySelector('dba-queue-item-detail')?.textContent).toContain('Acme SAS');
  });

  it('una cola desconocida no llama al servidor', async () => {
    const fixture = abrir('otra');
    await asentar(fixture);
    http.expectNone((r) => r.url.startsWith(BASE));
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    expect(host.textContent).toContain('Volver a Tareas');
  });
});

describe('Reintentar desde el detalle', () => {
  let http: HttpTestingController;
  const LISTA = `${BASE}/closing/items`;

  const abrirFila = async (pagina: QueueItemsPage = PAGINA): Promise<ComponentFixture<QueueDetailComponent>> => {
    const fixture = TestBed.createComponent(QueueDetailComponent);
    fixture.componentRef.setInput('queue', pagina.key);
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${BASE}/${pagina.key}/items`).flush(pagina);
    await asentar(fixture);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.dba-tr')?.click();
    await asentar(fixture);
    return fixture;
  };

  const boton = (host: HTMLElement, texto: string): HTMLButtonElement | undefined =>
    [...host.querySelectorAll<HTMLButtonElement>('.foot button')].find((b) => b.textContent?.includes(texto));

  const escribirMotivo = (host: HTMLElement, motivo: string): void => {
    const campo = host.querySelector('dba-queue-retry-confirm input, dba-queue-retry-confirm textarea') as HTMLInputElement;
    campo.value = motivo;
    campo.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:operations:manage']);
  });

  afterEach(() => http.verify());

  it('sin permiso de gestión solo deja cerrar', async () => {
    conPermisos(['platform:operations']);
    const fixture = await abrirFila();
    const host = fixture.nativeElement as HTMLElement;
    expect(boton(host, 'Reintentar')).toBeUndefined();
    expect(boton(host, 'Cerrar')).toBeDefined();
  });

  it('una notificación por otro canal no ofrece reintentar y lo explica', async () => {
    const fixture = await abrirFila({
      ...PAGINA,
      key: 'notifications',
      items: [{ ...PAGINA.items[0], kind: 'push', retryable: false }],
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(boton(host, 'Reintentar')).toBeUndefined();
    expect(host.textContent).toContain('Solo los correos vuelven a la cola');
  });

  it('pide motivo, avisa el efecto y actualiza la lista', async () => {
    const fixture = await abrirFila();
    const host = fixture.nativeElement as HTMLElement;
    boton(host, 'Reintentar')?.click();
    await asentar(fixture);
    expect(host.querySelector('.notice')?.textContent).toContain('Los ya hechos no se repiten');
    expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    expect(boton(host, 'Volver a la cola')?.disabled).toBe(true);

    escribirMotivo(host, 'Ya volvió el cofre');
    await asentar(fixture);
    boton(host, 'Volver a la cola')?.click();
    boton(host, 'Volver a la cola')?.click();
    const envio = http.expectOne(`${LISTA.replace('/items', '')}/items/t1/retry`);
    expect(envio.request.body).toEqual({ reason: 'Ya volvió el cofre' });
    envio.flush({ id: 't1', state: 'pending' });
    await fixture.whenStable();
    const lista = http.expectOne((r) => r.url === LISTA);
    expect(lista.request.params.get('state')).toBe('failed');
    lista.flush({ ...PAGINA, counts: { failed: 0, pending: 4, running: 0 }, total: 0, items: [] });
    await asentar(fixture);
    expect(host.querySelector('dba-queue-retry-confirm')).toBeNull();
    expect(host.querySelector('dba-queue-item-detail')).toBeNull();
    expect(host.textContent).toContain('No hay elementos fallidos');
  });

  it('si otro ya lo reintentó cierra y refresca la lista', async () => {
    const fixture = await abrirFila();
    const host = fixture.nativeElement as HTMLElement;
    boton(host, 'Reintentar')?.click();
    await asentar(fixture);
    escribirMotivo(host, 'Reintento');
    await asentar(fixture);
    boton(host, 'Volver a la cola')?.click();
    http
      .expectOne(`${BASE}/closing/items/t1/retry`)
      .flush({ code: 'ELEMENTO_NO_REINTENTABLE' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    http.expectOne((r) => r.url === LISTA).flush({ ...PAGINA, total: 0, items: [] });
    await asentar(fixture);
    expect(host.querySelector('dba-queue-retry-confirm')).toBeNull();
  });

  it('cancelar la confirmación vuelve al detalle', async () => {
    const fixture = await abrirFila();
    const host = fixture.nativeElement as HTMLElement;
    boton(host, 'Reintentar')?.click();
    await asentar(fixture);
    boton(host, 'Cancelar')?.click();
    await asentar(fixture);
    expect(host.querySelector('dba-queue-item-detail')).not.toBeNull();
  });
});
