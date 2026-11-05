import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Select } from 'primeng/select';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { isRecommended, parseSettingDraft, valueLabelOf } from '../data/settings-view';
import type { SettingChange, SettingItem } from '../data/settings.models';
import { SettingsHistoryComponent } from './settings-history.component';
import { SettingsComponent } from './settings.component';

const LLAVE_CRUDA = /\b(cfg|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/config';
const VER = ['platform:platform'];
const ADMINISTRAR = ['platform:platform', 'platform:platform:manage'];

const CUPO: SettingItem = {
  key: 'alerts.quota_warning_percent',
  group: 'alerts',
  kind: 'integer',
  unit: 'percent',
  value: 90,
  defaultValue: 90,
  isDefault: true,
  technical: { min: 1, max: 100 },
  recommended: { min: 70, max: 95 },
  maxItems: null,
  charset: null,
  version: 0,
  lastChange: null,
};

const HITOS: SettingItem = {
  key: 'alerts.plan_reminder_days',
  group: 'alerts',
  kind: 'integer_list',
  unit: 'days',
  value: [7, 1],
  defaultValue: [5, 1],
  isDefault: false,
  technical: { min: 1, max: 90 },
  recommended: { min: 1, max: 30 },
  maxItems: 5,
  charset: null,
  version: 3,
  lastChange: { at: '2026-11-05T10:00:00.000Z', adminName: 'Marta Vidal', reason: 'Más margen' },
};

const CAMBIO: SettingChange = {
  id: 'c1',
  key: HITOS.key,
  version: 3,
  action: 'change',
  from: [5, 1],
  fromDefault: true,
  to: [7, 1],
  toDefault: false,
  adminName: 'Marta Vidal',
  reason: 'Más margen',
  at: '2026-11-05T10:00:00.000Z',
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const listar = (http: HttpTestingController, items: SettingItem[] = [CUPO, HITOS]): void => {
  http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET').flush({ items });
};

const botonCon = (texto: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.trim().startsWith(texto),
  );

const montar = async (permisos: string[]) => {
  const http = await configurar();
  conPermisos(permisos);
  const fixture = TestBed.createComponent(SettingsComponent);
  listar(http);
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const abrir = async (fixture: ComponentFixture<unknown>, root: HTMLElement, indice = 0) => {
  root.querySelectorAll<HTMLButtonElement>('.bl-row')[indice].click();
  await asentar(fixture);
};

const escribir = async (fixture: ComponentFixture<unknown>, indice: number, valor: string) => {
  const campo = document.querySelectorAll<HTMLInputElement>('dba-setting-edit input')[indice];
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  await asentar(fixture);
};

describe('Configuración: valores', () => {
  it('valida el entero contra el rango técnico', () => {
    expect(parseSettingDraft(CUPO, '80')).toBe(80);
    expect(parseSettingDraft(CUPO, '101')).toBeNull();
    expect(parseSettingDraft(CUPO, '0')).toBeNull();
    expect(parseSettingDraft(CUPO, '8.5')).toBeNull();
    expect(parseSettingDraft(CUPO, '')).toBeNull();
  });

  it('valida la lista y la ordena de mayor a menor', () => {
    expect(parseSettingDraft(HITOS, '1, 3 7')).toEqual([7, 3, 1]);
    expect(parseSettingDraft(HITOS, '1, 1')).toBeNull();
    expect(parseSettingDraft(HITOS, '1,2,3,4,5,6')).toBeNull();
    expect(parseSettingDraft(HITOS, '91')).toBeNull();
    expect(parseSettingDraft(HITOS, '')).toBeNull();
  });

  it('usa el singular solo con un único valor en 1', () => {
    expect(valueLabelOf('days', 1).key).toBe('cfg.unit.daysOne');
    expect(valueLabelOf('days', [1]).key).toBe('cfg.unit.daysOne');
    expect(valueLabelOf('days', [5, 1]).key).toBe('cfg.unit.days');
  });
});

describe('Configuración: pestaña Avisos', () => {
  it('muestra valor, origen y último cambio sin llaves crudas', async () => {
    const { root } = await montar(VER);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Aviso de cupo');
    expect(texto).toContain('90 %');
    expect(texto).toContain('7, 1 días');
    expect(texto).toContain('Predeterminado');
    expect(texto).toContain('Cambiado');
    expect(texto).toContain('Marta Vidal');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('sin permiso de cambio solo se puede leer', async () => {
    const { fixture, root } = await montar(VER);
    await abrir(fixture, root, 1);
    const modal = document.querySelector('dba-setting-detail')?.textContent ?? '';
    expect(modal).toContain('Más margen');
    expect(modal).not.toMatch(LLAVE_CRUDA);
    expect(botonCon('Cambiar valor')).toBeUndefined();
    expect(botonCon('Volver al predeterminado')).toBeUndefined();
  });

  it('guarda con motivo y versión esperada', async () => {
    const { fixture, http, root } = await montar(ADMINISTRAR);
    await abrir(fixture, root);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);
    expect(botonCon('Guardar cambio')?.disabled).toBe(true);

    await escribir(fixture, 0, '80');
    expect(botonCon('Guardar cambio')?.disabled).toBe(true);
    await escribir(fixture, 1, 'Aviso más temprano');
    botonCon('Guardar cambio')?.click();
    await asentar(fixture);

    const put = http.expectOne((req) => req.method === 'PUT');
    expect(put.request.url).toContain(`${BASE}/${CUPO.key}`);
    expect(put.request.body).toEqual({
      value: 80,
      reason: 'Aviso más temprano',
      expectedVersion: 0,
    });
    put.flush({ ...CUPO, value: 80, version: 1, isDefault: false });
    await asentar(fixture);
    listar(http);
    await asentar(fixture);
    expect(document.querySelector('dba-setting-edit')).toBeNull();
  });

  it('avisa fuera de lo recomendado y deja continuar; no deja guardar lo imposible', async () => {
    const { fixture, root } = await montar(ADMINISTRAR);
    await abrir(fixture, root);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);

    await escribir(fixture, 1, 'Prueba');
    await escribir(fixture, 0, '50');
    const modal = () => document.querySelector('dba-setting-edit')?.textContent ?? '';
    expect(modal()).toContain('fuera de lo recomendado');
    expect(botonCon('Guardar cambio')?.disabled).toBe(false);

    await escribir(fixture, 0, '500');
    expect(modal()).toContain('de 1 a 100');
    expect(botonCon('Guardar cambio')?.disabled).toBe(true);
    expect(modal()).not.toMatch(LLAVE_CRUDA);
  });

  it('no envía nada si el valor no cambió', async () => {
    const { fixture, http, root } = await montar(ADMINISTRAR);
    await abrir(fixture, root);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);
    await escribir(fixture, 1, 'Sin cambio');
    expect(botonCon('Guardar cambio')?.disabled).toBe(true);
    http.expectNone((req) => req.method === 'PUT');
  });

  it('solo ofrece volver al predeterminado si el ajuste cambió', async () => {
    const { fixture, http, root } = await montar(ADMINISTRAR);
    await abrir(fixture, root, 0);
    expect(botonCon('Volver al predeterminado')).toBeUndefined();
    document.querySelector<HTMLButtonElement>('.head__close')?.click();
    await asentar(fixture);

    await abrir(fixture, root, 1);
    botonCon('Volver al predeterminado')?.click();
    await asentar(fixture);
    const campo = document.querySelector<HTMLInputElement>('dba-setting-action-confirm input');
    if (!campo) throw new Error('falta el motivo');
    campo.value = 'Volver';
    campo.dispatchEvent(new Event('input'));
    await asentar(fixture);
    expect(document.querySelector('dba-setting-action-confirm')?.textContent).toContain(
      '7, 1 días a 5, 1 días',
    );
    botonCon('Volver al predeterminado');
    [
      ...document.querySelectorAll<HTMLButtonElement>('dba-setting-action-confirm .foot__go'),
    ][0].click();
    await asentar(fixture);
    const post = http.expectOne((req) => req.url.endsWith(`${BASE}/${HITOS.key}/reset`));
    expect(post.request.body).toEqual({ reason: 'Volver', expectedVersion: 3 });
    post.flush(HITOS);
    await asentar(fixture);
    listar(http);
    await asentar(fixture);
  });

  it('si otra persona cambió el ajuste lo dice y recarga', async () => {
    const { fixture, http, root } = await montar(ADMINISTRAR);
    await abrir(fixture, root);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);
    await escribir(fixture, 0, '80');
    await escribir(fixture, 1, 'Prueba');
    botonCon('Guardar cambio')?.click();
    await asentar(fixture);
    http
      .expectOne((req) => req.method === 'PUT')
      .flush({ code: 'CONFIG_EN_CAMBIO' }, { status: 409, statusText: 'Conflict' });
    await asentar(fixture);
    listar(http, [{ ...CUPO, value: 85, version: 1, isDefault: false }]);
    await asentar(fixture);
    expect(document.querySelector('dba-setting-detail')?.textContent).toContain('85 %');
  });

  it('un error de carga permite reintentar', async () => {
    const http = await configurar();
    conPermisos(VER);
    const fixture = TestBed.createComponent(SettingsComponent);
    http.expectOne((req) => req.url.endsWith(BASE)).flush({}, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se pudieron cargar los ajustes');
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
  });
});

describe('Configuración: pestaña Accesos', () => {
  const VIGENCIA: SettingItem = {
    ...CUPO,
    key: 'access.otp_ttl_minutes',
    group: 'access',
    unit: 'minutes',
    value: 10,
    defaultValue: 10,
    technical: { min: 1, max: 60 },
    recommended: { min: 5, max: 15 },
  };
  const INTENTOS: SettingItem = {
    ...VIGENCIA,
    key: 'access.platform_otp_max_attempts',
    unit: 'attempts',
    value: 1,
    defaultValue: 5,
    isDefault: false,
  };

  it('muestra solo los ajustes del grupo, con su unidad y sin llaves crudas', async () => {
    const http = await configurar();
    conPermisos(VER);
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentRef.setInput('group', 'access');
    listar(http, [CUPO, VIGENCIA, INTENTOS]);
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const texto = root.textContent ?? '';
    expect(root.querySelectorAll('.bl-row')).toHaveLength(2);
    expect(texto).toContain('Vigencia del código de acceso');
    expect(texto).toContain('10 minutos');
    expect(texto).toContain('1 intento');
    expect(texto).not.toContain('Aviso de cupo');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });
});

describe('Configuración: pestaña Firma y documentos', () => {
  const ENLACE: SettingItem = {
    ...CUPO,
    key: 'signing.link_days',
    group: 'signing',
    unit: 'days',
    value: 3,
    defaultValue: 3,
    technical: { min: 1, max: 30 },
    recommended: { min: 2, max: 7 },
  };
  const RECORDATORIOS: SettingItem = {
    ...ENLACE,
    key: 'signing.reminder_max',
    unit: 'reminders',
    value: 1,
    defaultValue: 5,
    isDefault: false,
  };
  const FILAS: SettingItem = {
    ...ENLACE,
    key: 'signing.massive_max_rows',
    unit: 'rows',
    value: 2000,
    defaultValue: 2000,
  };
  const ADJUNTO: SettingItem = {
    ...ENLACE,
    key: 'signing.attachment_mb',
    unit: 'megabytes',
    value: 8,
    defaultValue: 8,
    technical: { min: 1, max: 8 },
    recommended: { min: 4, max: 8 },
  };

  it('muestra solo los ajustes de firma, con su unidad y sin llaves crudas', async () => {
    const http = await configurar();
    conPermisos(VER);
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentRef.setInput('group', 'signing');
    listar(http, [CUPO, ENLACE, RECORDATORIOS, FILAS, ADJUNTO]);
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const texto = root.textContent ?? '';
    expect(root.querySelectorAll('.bl-row')).toHaveLength(4);
    expect(texto).toContain('Vigencia del enlace de firma');
    expect(texto).toContain('3 días');
    expect(texto).toContain('1 recordatorio');
    expect(texto).toContain('2000 filas');
    expect(texto).toContain('8 MB');
    expect(texto).not.toContain('Aviso de cupo');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });
});

describe('Configuración: pestaña Validación', () => {
  const SIMILITUD: SettingItem = {
    ...CUPO,
    key: 'validation.face_similarity_percent',
    group: 'validation',
    value: 85,
    defaultValue: 85,
    technical: { min: 1, max: 100 },
    recommended: { min: 80, max: 95 },
  };
  const VIDA: SettingItem = {
    ...SIMILITUD,
    key: 'validation.liveness_confidence_percent',
    value: 75,
    defaultValue: 75,
    recommended: { min: 70, max: 90 },
  };

  it('muestra los umbrales en porcentaje y al editar avisa que cambia la validación de todas las organizaciones', async () => {
    const http = await configurar();
    conPermisos(ADMINISTRAR);
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentRef.setInput('group', 'validation');
    listar(http, [CUPO, SIMILITUD, VIDA]);
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const texto = root.textContent ?? '';
    expect(root.querySelectorAll('.bl-row')).toHaveLength(2);
    expect(texto).toContain('Similitud mínima del rostro');
    expect(texto).toContain('85 %');
    expect(texto).not.toContain('Aviso de cupo');
    expect(texto).not.toMatch(LLAVE_CRUDA);

    await abrir(fixture, root);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);
    const aviso = document.querySelector('dba-setting-edit .notice')?.textContent ?? '';
    expect(aviso).toContain('Cambia la validación de identidad de todas las organizaciones');
    await escribir(fixture, 0, '60');
    expect(document.querySelector('dba-setting-edit')?.textContent).toContain(
      'fuera de lo recomendado',
    );
  });
});

describe('Configuración: textos', () => {
  const LEGAL = [
    'Prohibida su reproducción total y/o parcial',
    'Todos los derechos reservados Docublock',
    'Propiedad intelectual de Docublock Ltd.',
  ];
  const REMITENTE: SettingItem = {
    ...CUPO,
    key: 'texts.sender_docublock',
    group: 'texts',
    kind: 'text',
    unit: 'text',
    value: 'Anasol de docublock',
    defaultValue: 'Anasol de docublock',
    technical: { min: 1, max: 60 },
    recommended: { min: 3, max: 40 },
    charset: 'name',
    version: 2,
  };
  const SELLO: SettingItem = {
    ...CUPO,
    key: 'texts.seal_legal_lines',
    group: 'texts',
    kind: 'text_list',
    unit: 'lines',
    value: ['Uno', 'Dos'],
    defaultValue: LEGAL,
    isDefault: false,
    technical: { min: 1, max: 45 },
    recommended: { min: 3, max: 40 },
    maxItems: 3,
    charset: 'line',
    version: 4,
  };

  const montarTextos = async (permisos: string[] = ADMINISTRAR) => {
    const http = await configurar();
    conPermisos(permisos);
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentRef.setInput('group', 'texts');
    listar(http, [CUPO, REMITENTE, SELLO]);
    await asentar(fixture);
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  };

  const escribirArea = async (fixture: ComponentFixture<unknown>, valor: string) => {
    const area = document.querySelector<HTMLTextAreaElement>('dba-setting-edit textarea');
    if (!area) throw new Error('falta el área de texto');
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    await asentar(fixture);
  };

  it('el nombre del remitente se recorta y rechaza lo que permitiría suplantar a otro', () => {
    expect(parseSettingDraft(REMITENTE, '  Equipo Docublock  ')).toBe('Equipo Docublock');
    expect(parseSettingDraft(REMITENTE, 'Soporte <otro@correo.co>')).toBeNull();
    expect(parseSettingDraft(REMITENTE, 'soporte@docublock.co')).toBeNull();
    expect(parseSettingDraft(REMITENTE, 'Equipo "Docublock"')).toBeNull();
    expect(parseSettingDraft(REMITENTE, 'Equipo\\Docublock')).toBeNull();
    expect(parseSettingDraft(REMITENTE, '   ')).toBeNull();
    expect(parseSettingDraft(REMITENTE, 'x'.repeat(61))).toBeNull();
  });

  it('las líneas del sello van una por renglón, en orden, sin renglones vacíos', () => {
    expect(parseSettingDraft(SELLO, ' Tres \n\nUno\r\nDos ')).toEqual(['Tres', 'Uno', 'Dos']);
    expect(parseSettingDraft(SELLO, 'a\nb\nc\nd')).toBeNull();
    expect(parseSettingDraft(SELLO, `${'x'.repeat(46)}\nb`)).toBeNull();
    expect(parseSettingDraft(SELLO, 'Con\ttabulador')).toBeNull();
    expect(parseSettingDraft(SELLO, '\n \n')).toBeNull();
  });

  it('lo recomendado se mide en caracteres y las líneas se muestran separadas', () => {
    expect(isRecommended(REMITENTE, 'Equipo Docublock')).toBe(true);
    expect(isRecommended(REMITENTE, 'Eq')).toBe(false);
    expect(isRecommended(SELLO, ['Uno', 'Do'])).toBe(false);
    expect(valueLabelOf('lines', ['Uno', 'Dos'])).toEqual({
      key: 'cfg.unit.lines',
      params: { value: 'Uno · Dos' },
    });
  });

  it('muestra solo los textos, sin letra de código, con el valor completo al pasar el puntero', async () => {
    const { root } = await montarTextos(VER);
    expect(root.querySelectorAll('.bl-row')).toHaveLength(2);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Remitente de los correos de Docublock');
    expect(texto).toContain('Anasol de docublock');
    expect(texto).toContain('Texto legal del sello');
    expect(texto).toContain('Uno · Dos');
    expect(texto).not.toContain('Aviso de cupo');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    const valores = [...root.querySelectorAll<HTMLElement>('.bl-row .cell__text')];
    expect(valores.every((valor) => !valor.classList.contains('dba-mono'))).toBe(true);
    expect(valores[1].title).toBe('Uno · Dos');
  });

  it('el detalle del sello pone cada línea en su renglón y el rango en caracteres', async () => {
    const { fixture, root } = await montarTextos(VER);
    await abrir(fixture, root, 1);
    const modal = document.querySelector('dba-setting-detail');
    const lineas = modal?.querySelector<HTMLElement>('dd.item__lines');
    expect(lineas?.textContent?.trim()).toBe('Uno\nDos');
    expect(modal?.textContent).toContain('De 3 a 40 caracteres por línea, hasta 3 líneas');
    expect(modal?.textContent).toContain('los ya generados no cambian');
    expect(modal?.textContent).not.toMatch(LLAVE_CRUDA);
  });

  it('cambia el remitente con un campo de texto y avisa qué caracteres no van', async () => {
    const { fixture, http, root } = await montarTextos();
    await abrir(fixture, root, 0);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);
    const campo = document.querySelector<HTMLInputElement>('dba-setting-edit input');
    expect(campo?.getAttribute('inputmode')).toBeNull();
    expect(campo?.getAttribute('maxlength')).toBe('60');
    const modal = () => document.querySelector('dba-setting-edit')?.textContent ?? '';
    expect(modal()).toContain('Predeterminado: «Anasol de docublock».');

    await escribir(fixture, 1, 'Marca nueva');
    await escribir(fixture, 0, 'Equipo <x@y.co>');
    expect(modal()).toContain('sin @, comillas, barra invertida');
    expect(botonCon('Guardar cambio')?.disabled).toBe(true);

    await escribir(fixture, 0, 'Eq');
    expect(modal()).toContain('El largo está fuera de lo recomendado');
    await escribir(fixture, 0, '  Equipo Docublock ');
    expect(modal()).not.toMatch(LLAVE_CRUDA);
    botonCon('Guardar cambio')?.click();
    await asentar(fixture);
    const put = http.expectOne((req) => req.method === 'PUT');
    expect(put.request.url).toContain(`${BASE}/${REMITENTE.key}`);
    expect(put.request.body).toEqual({
      value: 'Equipo Docublock',
      reason: 'Marca nueva',
      expectedVersion: 2,
    });
    put.flush({ ...REMITENTE, value: 'Equipo Docublock' });
    await asentar(fixture);
    listar(http);
    await asentar(fixture);
  });

  it('cambia las líneas del sello en un área de texto, una por renglón', async () => {
    const { fixture, http, root } = await montarTextos();
    await abrir(fixture, root, 1);
    botonCon('Cambiar valor')?.click();
    await asentar(fixture);
    const area = document.querySelector<HTMLTextAreaElement>('dba-setting-edit textarea');
    expect(area?.value).toBe('Uno\nDos');
    const modal = () => document.querySelector('dba-setting-edit')?.textContent ?? '';
    expect(modal()).toContain('Escribe cada línea en un renglón, hasta 3.');

    await escribir(fixture, 0, 'Texto de la firma');
    await escribirArea(fixture, 'a\nb\nc\nd');
    expect(modal()).toContain('Escribe de 1 a 3 líneas, cada una de 1 a 45 caracteres.');
    expect(botonCon('Guardar cambio')?.disabled).toBe(true);

    await escribirArea(fixture, 'Propiedad de Docublock\n\nReservados todos los derechos');
    expect(modal()).not.toMatch(LLAVE_CRUDA);
    botonCon('Guardar cambio')?.click();
    await asentar(fixture);
    const put = http.expectOne((req) => req.method === 'PUT');
    expect(put.request.body).toEqual({
      value: ['Propiedad de Docublock', 'Reservados todos los derechos'],
      reason: 'Texto de la firma',
      expectedVersion: 4,
    });
    put.flush(SELLO);
    await asentar(fixture);
    listar(http);
    await asentar(fixture);
  });

  it('la pestaña Textos va entre Validación y Credenciales', async () => {
    const { root } = await montarTextos(VER);
    const pestañas = [...root.querySelectorAll('dba-settings-tabs a')].map((a) =>
      a.textContent?.trim(),
    );
    const posicion = pestañas.indexOf('Textos');
    expect(pestañas[posicion - 1]).toBe('Validación');
    expect(pestañas[posicion + 1]).toBe('Credenciales');
  });
});

describe('Configuración: pestaña Historial', () => {
  const atender = (http: HttpTestingController, items: SettingChange[], total = items.length) => {
    listar(http);
    http
      .expectOne((req) => req.url.endsWith(`${BASE}/history`))
      .flush({ total, page: 1, limit: 20, items });
  };

  const montarHistorial = async (
    permisos: string[],
    items: SettingChange[] = [CAMBIO],
    total?: number,
  ) => {
    const http = await configurar();
    conPermisos(permisos);
    const fixture = TestBed.createComponent(SettingsHistoryComponent);
    atender(http, items, total);
    await asentar(fixture);
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  };

  it('muestra el cambio, quién y por qué, con el predeterminado marcado', async () => {
    const { root } = await montarHistorial(VER);
    const texto = root.textContent ?? '';
    expect(texto).toContain('7, 1 días');
    expect(texto).toContain('Antes: 5, 1 días (predeterminado)');
    expect(texto).toContain('Marta Vidal');
    expect(texto).toContain('Más margen');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('sin permiso de cambio no ofrece restaurar', async () => {
    await montarHistorial(VER);
    expect(botonCon('Restaurar')).toBeUndefined();
  });

  it('no ofrece restaurar si el valor anterior es el que ya rige', async () => {
    const igual = { ...CAMBIO, from: [7, 1], fromDefault: false };
    await montarHistorial(ADMINISTRAR, [igual]);
    expect(botonCon('Restaurar')).toBeUndefined();
  });

  it('restaura con motivo y la versión vigente', async () => {
    const { fixture, http } = await montarHistorial(ADMINISTRAR);
    botonCon('Restaurar')?.click();
    await asentar(fixture);
    expect(document.querySelector('dba-setting-action-confirm')?.textContent).toContain(
      '5, 1 días (predeterminado)',
    );
    const campo = document.querySelector<HTMLInputElement>('dba-setting-action-confirm input');
    if (!campo) throw new Error('falta el motivo');
    campo.value = 'Deshacer';
    campo.dispatchEvent(new Event('input'));
    await asentar(fixture);
    document.querySelector<HTMLButtonElement>('dba-setting-action-confirm .foot__go')?.click();
    await asentar(fixture);
    const post = http.expectOne((req) => req.url.endsWith(`${BASE}/history/c1/restore`));
    expect(post.request.body).toEqual({ reason: 'Deshacer', expectedVersion: 3 });
    post.flush(HITOS);
    await asentar(fixture);
    atender(http, []);
    await asentar(fixture);
  });

  it('filtra por ajuste y pagina', async () => {
    const { fixture, http, root } = await montarHistorial(VER, [CAMBIO], 45);
    expect(root.querySelector('db-pager')).not.toBeNull();
    fixture.debugElement.query(By.directive(Select)).triggerEventHandler('ngModelChange', CUPO.key);
    await asentar(fixture);
    listar(http);
    const pedido = http.expectOne((req) => req.url.endsWith(`${BASE}/history`));
    expect(pedido.request.params.get('key')).toBe(CUPO.key);
    expect(pedido.request.params.get('page')).toBe('1');
    pedido.flush({ total: 0, page: 1, limit: 20, items: [] });
    await asentar(fixture);
    await asentar(fixture);
    expect(root.textContent).toContain('Este ajuste no se ha cambiado.');
  });
});
