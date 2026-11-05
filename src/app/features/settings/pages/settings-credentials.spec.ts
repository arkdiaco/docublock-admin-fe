import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { credentialStateOf, knownCredentialGroups, piecesOf } from '../data/credentials-view';
import type { CredentialGroup } from '../data/settings.models';
import { SettingsCredentialsComponent } from './settings-credentials.component';

const LLAVE_CRUDA = /\b(cfg|nav|common)\.[a-zA-Z]/;
const RUTA = '/platform/config/credentials';
const VER = ['platform:platform'];

const COMMONS: CredentialGroup = {
  key: 'commons',
  state: 'configured',
  items: [
    { variable: 'COMMONS_SERVICE_URL', kind: 'url', required: true, configured: true },
    { variable: 'COMMONS_SERVICE_KEY', kind: 'serviceKey', required: true, configured: true },
  ],
};

const MOTOR: CredentialGroup = {
  key: 'motor',
  state: 'partial',
  items: [
    { variable: 'MOTOR_WS_URL', kind: 'url', required: true, configured: true },
    { variable: 'MOTOR_WS_PASSWORD', kind: 'password', required: true, configured: false },
    {
      variable: 'MOTOR_CA_CERT_BASE64',
      kind: 'authorityCertificate',
      required: false,
      configured: false,
    },
  ],
};

const HOGAR: CredentialGroup = {
  key: 'smartHome',
  state: 'missing',
  items: [{ variable: 'SMART_HOME_API_URL', kind: 'url', required: true, configured: false }],
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const responder = (http: HttpTestingController, groups: CredentialGroup[]): void => {
  http.expectOne((req) => req.url.endsWith(RUTA) && req.method === 'GET').flush({ groups });
};

const montar = async (groups: CredentialGroup[] = [COMMONS, MOTOR, HOGAR]) => {
  const http = await configurar();
  conPermisos(VER);
  const fixture = TestBed.createComponent(SettingsCredentialsComponent);
  responder(http, groups);
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const abrir = async (fixture: ComponentFixture<unknown>, root: HTMLElement, indice: number) => {
  root.querySelectorAll<HTMLButtonElement>('.bl-row')[indice].click();
  await asentar(fixture);
};

const filas = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('.bl-row')].map((fila) =>
    (fila.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );

describe('Configuración: estado de credenciales', () => {
  it('traduce cada estado a la pieza de estado de la casa', () => {
    expect(credentialStateOf('configured')).toEqual({
      state: 'active',
      labelKey: 'cfg.cred.state.configured',
    });
    expect(credentialStateOf('partial').state).toBe('warning');
    expect(credentialStateOf('missing').state).toBe('closed');
  });

  it('cuenta las piezas puestas y deja fuera las integraciones que el admin no conoce', () => {
    expect(piecesOf(MOTOR)).toEqual({ set: 1, total: 3 });
    const nueva = { ...HOGAR, key: 'otraNueva' };
    expect(knownCredentialGroups([COMMONS, nueva]).map((group) => group.key)).toEqual(['commons']);
  });
});

describe('Configuración: pestaña Credenciales', () => {
  it('lista cada integración con su estado y sus piezas, sin llaves crudas', async () => {
    const { root } = await montar();
    expect(filas(root)).toEqual([
      expect.stringContaining('Comunicaciones y archivos'),
      expect.stringContaining('Motor de estrategia'),
      expect.stringContaining('Hogar inteligente'),
    ]);
    const [commons, motor, hogar] = filas(root);
    expect(commons).toContain('Configurada');
    expect(commons).toContain('2 de 2');
    expect(motor).toContain('Incompleta');
    expect(motor).toContain('1 de 3');
    expect(hogar).toContain('Sin configurar');
    const texto = root.textContent ?? '';
    expect(texto).toContain('Nunca muestra valores');
    expect(texto).toContain('Comercial › Facturación');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('el detalle nombra cada variable, marca las opcionales y explica lo que falta', async () => {
    const { fixture, root } = await montar();
    await abrir(fixture, root, 1);
    const modal = document.querySelector('dba-credential-detail')?.textContent ?? '';
    expect(modal).toContain('Motor de estrategia');
    expect(modal).toContain('MOTOR_WS_URL');
    expect(modal).toContain('Dirección del servicio');
    expect(modal).toContain('Contraseña');
    expect(modal).toContain('Certificado de la autoridad');
    expect(modal).toContain('Opcional');
    expect(modal).toContain('Puesta');
    expect(modal).toContain('Falta');
    expect(modal).toContain('Falta al menos una pieza obligatoria');
    expect(modal).not.toMatch(LLAVE_CRUDA);
  });

  it('una integración configurada no muestra aviso y se cierra sin botones de cambio', async () => {
    const { fixture, root } = await montar();
    await abrir(fixture, root, 0);
    const modal = document.querySelector('dba-credential-detail');
    expect(modal?.textContent).not.toContain('Falta al menos');
    expect(modal?.textContent).not.toContain('No está configurada');
    const botones = [...(modal?.querySelectorAll('button') ?? [])]
      .map((boton) => boton.textContent?.trim())
      .filter(Boolean);
    expect(botones.every((texto) => texto === 'Cerrar')).toBe(true);
  });

  it('si la lectura falla ofrece reintentar', async () => {
    const http = await configurar();
    conPermisos(VER);
    const fixture = TestBed.createComponent(SettingsCredentialsComponent);
    http
      .expectOne((req) => req.url.endsWith(RUTA))
      .flush({ message: 'caída' }, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se pudieron cargar las credenciales');
    const reintentar = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (boton) => boton.textContent?.trim() === 'Reintentar',
    );
    reintentar?.click();
    responder(http, [COMMONS]);
    await asentar(fixture);
    expect(filas(root)).toHaveLength(1);
  });

  it('la pestaña aparece entre Validación e Historial', async () => {
    const { root } = await montar();
    const pestañas = [...root.querySelectorAll('dba-settings-tabs a')].map((a) =>
      a.textContent?.trim(),
    );
    const posicion = pestañas.indexOf('Credenciales');
    expect(posicion).toBeGreaterThan(pestañas.indexOf('Validación'));
    expect(pestañas[posicion + 1]).toBe('Historial');
  });
});
