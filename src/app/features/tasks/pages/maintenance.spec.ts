import { HttpErrorResponse } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { canExecute, rehearsalNoteKey, taskStateOf } from '../data/maintenance-view';
import { maintenanceErrorKey } from '../data/tasks.api';
import type { MaintenanceRun, MaintenanceTaskView } from '../data/tasks.models';
import { MAINTENANCE_POLL_MS, MaintenanceComponent } from './maintenance.component';

const LLAVE_CRUDA = /\b(task|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/tasks/maintenance';
const RUNS = `${BASE}/runs?page=1&limit=20`;
const RID = '64b000000000000000000011';

const ENSAYO: MaintenanceRun = {
  id: RID,
  task: 'syncRolePermissions',
  mode: 'rehearsal',
  state: 'ok',
  adminId: 'a1',
  admin: { id: 'a1', name: 'Ada Lovelace' },
  reason: null,
  rehearsalId: null,
  startedAt: '2026-11-04T10:00:00.000Z',
  finishedAt: '2026-11-04T10:00:02.000Z',
  durationMs: 2000,
  scanned: 10,
  pending: 3,
  changed: 0,
  failed: 0,
  items: [{ label: 'Administrador', detail: '3', state: 'pending' }],
  itemsTruncated: false,
  error: null,
};

const EJECUCION: MaintenanceRun = {
  ...ENSAYO,
  id: '64b000000000000000000012',
  mode: 'execution',
  reason: 'Faltaban permisos',
  rehearsalId: RID,
  startedAt: '2026-11-04T10:05:00.000Z',
  finishedAt: '2026-11-04T10:05:01.000Z',
  changed: 3,
  items: [{ label: 'Administrador', detail: '3', state: 'done' }],
};

const tarea = (
  overrides: Partial<MaintenanceTaskView> & Pick<MaintenanceTaskView, 'key'>,
): MaintenanceTaskView => ({
  running: false,
  lastRehearsal: null,
  lastExecution: null,
  validRehearsalId: null,
  ...overrides,
});

const VIGENTE = tarea({ key: 'syncRolePermissions', lastRehearsal: ENSAYO, validRehearsalId: RID });

const TAREAS: MaintenanceTaskView[] = [
  tarea({ key: 'verifyIndexes' }),
  tarea({
    key: 'seedSystemRoles',
    lastRehearsal: { ...ENSAYO, task: 'seedSystemRoles', pending: 0, items: [] },
    validRehearsalId: RID,
  }),
  VIGENTE,
  tarea({ key: 'grantDerivedPermissions', lastRehearsal: { ...ENSAYO, task: 'grantDerivedPermissions' } }),
];

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const montar = async (
  permisos: string[],
  tareas: MaintenanceTaskView[] = TAREAS,
  corridas: MaintenanceRun[] = [],
): Promise<{ fixture: ComponentFixture<MaintenanceComponent>; http: HttpTestingController; root: HTMLElement }> => {
  const http = await configurar();
  conPermisos(permisos);
  const fixture = TestBed.createComponent(MaintenanceComponent);
  http.expectOne(BASE).flush({ tasks: tareas });
  http.expectOne(RUNS).flush({ total: corridas.length, items: corridas });
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const abrir = (root: HTMLElement, indice: number): void => {
  root.querySelectorAll<HTMLButtonElement>('button.bl-row')[indice].click();
};

const botonCon = (texto: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === texto);

describe('Tareas: mantenimiento', () => {
  it('lista las tareas y el historial, sin llaves crudas', async () => {
    const { root } = await montar(['platform:operations'], TAREAS, [EJECUCION, ENSAYO]);
    const texto = root.textContent ?? '';
    expect(root.querySelectorAll('button.bl-row')).toHaveLength(6);
    expect(texto).toContain('Verificar índices');
    expect(texto).toContain('Sin ensayar');
    expect(texto).toContain('Al día');
    expect(texto).toContain('Con pendientes');
    expect(texto).toContain('Pendientes: 3');
    expect(texto).toContain('Cambiados: 3');
    expect(texto).toContain('Faltaban permisos');
    expect(texto).toContain('Ada Lovelace');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('muestra error con reintento si la lista falla', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(MaintenanceComponent);
    http.expectOne(BASE).flush({}, { status: 500, statusText: 'Error' });
    http.expectOne(RUNS).flush({ total: 0, items: [] });
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pudimos cargar las tareas');
  });

  it('sin permiso de administrar no ofrece ensayar ni ejecutar', async () => {
    const { fixture, root } = await montar(['platform:operations']);
    abrir(root, 2);
    await asentar(fixture);
    expect(botonCon('Ejecutar')).toBeUndefined();
    expect(botonCon('Ensayar')).toBeUndefined();
    expect(botonCon('Volver a ensayar')).toBeUndefined();
    expect(botonCon('Cerrar')).toBeDefined();
  });

  it('sin ensayo solo ofrece ensayar, y sigue la corrida hasta que termina', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    abrir(root, 0);
    await asentar(fixture);
    expect(botonCon('Ejecutar')).toBeUndefined();
    expect(document.body.textContent).toContain('Ensayar no escribe nada');

    vi.useFakeTimers();
    try {
      botonCon('Ensayar')?.click();
      const envio = http.expectOne(`${BASE}/verifyIndexes/rehearse`);
      expect(envio.request.body).toEqual({});
      envio.flush({ id: RID, key: 'verifyIndexes', state: 'running' });
      await vi.advanceTimersByTimeAsync(0);
      http.expectOne(BASE).flush({ tasks: [tarea({ key: 'verifyIndexes', running: true })] });
      http.expectOne(RUNS).flush({ total: 0, items: [] });
      await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS);
      http.expectOne(BASE).flush({ tasks: [tarea({ key: 'verifyIndexes' })] });
      http.expectOne(RUNS).flush({ total: 0, items: [] });
      await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS * 2);
      http.expectNone(BASE);
    } finally {
      vi.useRealTimers();
    }
    http.verify();
  });

  it('un ensayo sin nada pendiente no ofrece ejecutar y lo explica', async () => {
    const { fixture, root } = await montar(['platform:operations:manage']);
    abrir(root, 1);
    await asentar(fixture);
    expect(botonCon('Ejecutar')).toBeUndefined();
    expect(document.body.textContent).toContain('No hay nada que ejecutar');
    expect(botonCon('Volver a ensayar')).toBeDefined();
  });

  it('un ensayo vencido no deja ejecutar y pide ensayar de nuevo', async () => {
    const { fixture, root } = await montar(['platform:operations:manage']);
    abrir(root, 3);
    await asentar(fixture);
    expect(botonCon('Ejecutar')).toBeUndefined();
    expect(document.body.textContent).toContain('Este ensayo venció');
  });

  it('una ejecución gasta el ensayo y pide ensayar de nuevo', async () => {
    const { fixture, root } = await montar(
      ['platform:operations:manage'],
      [{ ...VIGENTE, validRehearsalId: null, lastExecution: EJECUCION }],
    );
    abrir(root, 0);
    await asentar(fixture);
    expect(botonCon('Ejecutar')).toBeUndefined();
    expect(botonCon('Volver a ensayar')).toBeDefined();
    expect(document.body.textContent).toContain('Ya se ejecutó después de este ensayo');
  });

  it('no deja ensayar mientras la tarea corre', async () => {
    const { fixture, http, root } = await montar(
      ['platform:operations:manage'],
      [tarea({ key: 'verifyIndexes', running: true })],
    );
    abrir(root, 0);
    await asentar(fixture);
    expect(botonCon('Ensayar')?.disabled).toBe(true);
    fixture.destroy();
    http.verify();
  });

  it('ejecuta con el motivo y el ensayo vigente', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    abrir(root, 2);
    await asentar(fixture);
    expect(document.body.textContent).toContain('Administrador');
    botonCon('Ejecutar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('Pendientes según el ensayo: 3');
    expect(document.body.textContent).toContain('van a poder hacer más cosas');
    expect(botonCon('Ejecutar')?.disabled).toBe(true);
    const campo = document.querySelector<HTMLInputElement>('.form input, .form textarea');
    if (!campo) throw new Error('Falta el campo de motivo');
    campo.value = 'Faltaban permisos';
    campo.dispatchEvent(new Event('input'));
    await asentar(fixture);
    botonCon('Ejecutar')?.click();
    const envio = http.expectOne(`${BASE}/syncRolePermissions/execute`);
    expect(envio.request.body).toEqual({ reason: 'Faltaban permisos', rehearsalId: RID });
  });

  it('abre una corrida del historial con sus elementos', async () => {
    const { fixture, http, root } = await montar(
      ['platform:operations'],
      [],
      [{ ...EJECUCION, items: [] }],
    );
    abrir(root, 0);
    http.expectOne(`${BASE}/runs/${EJECUCION.id}`).flush(EJECUCION);
    await asentar(fixture);
    const detalle = document.querySelector('dba-maintenance-run-detail')?.textContent ?? '';
    expect(detalle).toContain('Aplicado');
    expect(detalle).toContain('Faltaban permisos');
    expect(detalle).not.toMatch(LLAVE_CRUDA);
  });
});

describe('Vista de mantenimiento', () => {
  it('resume el estado de la tarea', () => {
    expect(taskStateOf(tarea({ key: 'verifyIndexes' })).labelKey).toBe('task.mnt.state.never');
    expect(taskStateOf(tarea({ key: 'verifyIndexes', running: true })).labelKey).toBe('task.mnt.state.running');
    expect(taskStateOf(VIGENTE).labelKey).toBe('task.mnt.state.pendingWork');
    expect(taskStateOf({ ...VIGENTE, lastExecution: EJECUCION }).labelKey).toBe('task.mnt.state.upToDate');
    expect(taskStateOf({ ...VIGENTE, lastExecution: { ...EJECUCION, state: 'partial' } }).state).toBe('warning');
    expect(taskStateOf({ ...VIGENTE, lastRehearsal: { ...ENSAYO, state: 'failed' } }).state).toBe('suspended');
  });

  it('solo deja ejecutar con un ensayo vigente y algo pendiente', () => {
    expect(canExecute(VIGENTE)).toBe(true);
    expect(canExecute({ ...VIGENTE, validRehearsalId: null })).toBe(false);
    expect(canExecute({ ...VIGENTE, lastRehearsal: { ...ENSAYO, pending: 0 } })).toBe(false);
  });

  it('explica por qué no se puede ejecutar', () => {
    expect(rehearsalNoteKey(tarea({ key: 'verifyIndexes' }))).toBe('task.mnt.note.none');
    expect(rehearsalNoteKey(VIGENTE)).toBe('task.mnt.note.valid');
    expect(rehearsalNoteKey({ ...VIGENTE, validRehearsalId: null })).toBe('task.mnt.note.expired');
    expect(rehearsalNoteKey({ ...VIGENTE, validRehearsalId: null, lastExecution: EJECUCION })).toBe('task.mnt.note.used');
    expect(rehearsalNoteKey({ ...VIGENTE, lastRehearsal: { ...ENSAYO, state: 'interrupted' } })).toBe(
      'task.mnt.note.failed',
    );
  });

  it('distingue los errores por su código', () => {
    const con = (status: number, code?: string): HttpErrorResponse =>
      new HttpErrorResponse({ status, error: code ? { code } : null });
    expect(maintenanceErrorKey(con(409, 'ENSAYO_REQUERIDO'))).toBe('task.mnt.error.rehearsalRequired');
    expect(maintenanceErrorKey(con(409, 'TAREA_EN_CURSO'))).toBe('task.mnt.error.busy');
    expect(maintenanceErrorKey(con(403))).toBe('task.mnt.error.forbidden');
    expect(maintenanceErrorKey(con(500))).toBe('task.mnt.error.failed');
  });
});
