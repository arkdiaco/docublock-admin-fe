import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { DialogService } from '../../../core/ui/dialog.service';
import { parseDocTypes } from '../components/capabilities-form.component';
import { countryChangesOf, type CountryFormValue } from '../components/country-form.component';
import { slugOf } from '../components/property-item-form.component';
import { conPermisos, configurar, pais, politica } from './catalogs-test-kit';
import { CitiesComponent } from './cities.component';
import { ConsentPoliciesComponent } from './consent-policies.component';
import { CountriesComponent } from './countries.component';
import { CountryDetailComponent } from './country-detail.component';
import { IdentificationTypesComponent } from './identification-types.component';
import { KindPersonsComponent } from './kind-persons.component';
import { PropertyCatalogComponent } from './property-catalog.component';
import { SignerFieldsComponent } from './signer-fields.component';

const LLAVE_CRUDA = /\b(cat|nav|act|sub|common)\.[a-zA-Z]/;
const LEER = ['platform:catalogs'];
const GESTIONAR = ['platform:catalogs:manage'];

describe('Catálogos › pantallas', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const abrir = <T>(tipo: new () => T, permisos: string[]): ComponentFixture<T> => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(tipo as never) as ComponentFixture<T>;
    fixture.detectChanges();
    return fixture;
  };

  const ver = async (fixture: ComponentFixture<unknown>, texto: string): Promise<HTMLElement> => {
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain(texto);
    });
    return host;
  };

  const opciones = () =>
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);

  describe('Países', () => {
    const lista = () => http.expectOne((req) => req.url === '/platform/catalogs/countries');

    it('lista con conteos, sin botón de crear si solo puede leer', async () => {
      const fixture = abrir(CountriesComponent, LEER);
      lista().flush({ total: 1, items: [pais()] });
      const host = await ver(fixture, 'Colombia');
      expect(host.textContent).toContain('1123');
      expect(host.textContent).not.toContain('Nuevo país');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('con gestión ofrece crear', async () => {
      const fixture = abrir(CountriesComponent, GESTIONAR);
      lista().flush({ total: 1, items: [pais()] });
      const host = await ver(fixture, 'Nuevo país');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('si falla la carga ofrece reintentar', async () => {
      const fixture = abrir(CountriesComponent, LEER);
      lista().flush({}, { status: 500, statusText: 'x' });
      const host = await ver(fixture, 'No pudimos cargar el catálogo');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });
  });

  describe('Ficha del país', () => {
    const abrirFicha = (permisos: string[]) => {
      conPermisos(permisos);
      const fixture = TestBed.createComponent(CountryDetailComponent);
      fixture.componentRef.setInput('id', 'co');
      fixture.detectChanges();
      http.expectOne('/platform/catalogs/countries/co').flush(pais());
      return fixture;
    };

    it('solo lectura: sin acciones ni historial, y sin proveedores', async () => {
      const fixture = abrirFicha(LEER);
      const host = await ver(fixture, 'Capacidades');
      expect(host.textContent).not.toContain('Editar perfil');
      expect(host.textContent).not.toContain('Historial');
      expect(host.textContent).not.toContain('provider');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('con gestión e historial pinta acciones e historial', async () => {
      const fixture = abrirFicha([...GESTIONAR, 'platform:platform']);
      const host = await ver(fixture, 'Editar capacidades');
      expect(host.textContent).toContain('Historial');
      await vi.waitFor(() => {
        const pedido = http.expectOne((req) => req.url === '/platform/audit');
        pedido.flush({ total: 0, items: [] });
      });
    });

    it('un país inexistente lo dice', async () => {
      conPermisos(LEER);
      const fixture = TestBed.createComponent(CountryDetailComponent);
      fixture.componentRef.setInput('id', 'zz');
      fixture.detectChanges();
      http.expectOne('/platform/catalogs/countries/zz').flush({}, { status: 404, statusText: 'x' });
      await ver(fixture, 'País no encontrado');
    });

    it('borrar un país en uso avisa cuántos registros lo usan', async () => {
      const fixture = abrirFicha(GESTIONAR);
      const host = await ver(fixture, 'Borrar');
      vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
        answer: 'confirm',
        reason: 'limpieza',
      });
      const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
      const boton = [...host.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Borrar'),
      );
      boton?.click();
      const pedido = await vi.waitFor(() =>
        http.expectOne((req) => req.method === 'DELETE' && req.url.endsWith('/countries/co')),
      );
      expect(pedido.request.body).toEqual({ reason: 'limpieza' });
      pedido.flush(
        { code: 'CATALOGO_EN_USO', usage: 12 },
        { status: 409, statusText: 'x' },
      );
      await vi.waitFor(() => expect(avisos).toHaveBeenCalled());
      expect(JSON.stringify(avisos.mock.calls[0])).toContain('12');
    });
  });

  describe('Ciudades', () => {
    it('lista, sin menú si solo puede leer', async () => {
      const fixture = abrir(CitiesComponent, LEER);
      opciones();
      http
        .expectOne((req) => req.url === '/platform/catalogs/cities')
        .flush({
          total: 1,
          items: [{ id: 'c1', name: 'Bogotá', code: '11001', countryId: 'co', countryName: 'Colombia' }],
        });
      const host = await ver(fixture, 'Bogotá');
      expect(host.querySelector('dba-catalog-row-menu')).toBeNull();
      expect(host.textContent).not.toContain('Nueva ciudad');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('con gestión pinta el menú de la fila', async () => {
      const fixture = abrir(CitiesComponent, GESTIONAR);
      opciones();
      http
        .expectOne((req) => req.url === '/platform/catalogs/cities')
        .flush({
          total: 1,
          items: [{ id: 'c1', name: 'Bogotá', code: '11001', countryId: 'co' }],
        });
      const host = await ver(fixture, 'Bogotá');
      expect(host.querySelector('dba-catalog-row-menu')).not.toBeNull();
      expect(host.textContent).toContain('Nueva ciudad');
    });
  });

  describe('Tipos de persona', () => {
    it('lista con su clase y sin llaves crudas', async () => {
      const fixture = abrir(KindPersonsComponent, LEER);
      opciones();
      http
        .expectOne((req) => req.url === '/platform/catalogs/kind-persons')
        .flush({
          total: 1,
          items: [
            {
              id: 'k1',
              name: 'Natural',
              type: 'natural',
              countryId: 'co',
              countryName: 'Colombia',
              identificationTypesCount: 4,
            },
          ],
        });
      const host = await ver(fixture, 'Persona natural');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });
  });

  describe('Tipos de identificación', () => {
    it('lista con formato y sin llaves crudas', async () => {
      const fixture = abrir(IdentificationTypesComponent, LEER);
      opciones();
      http
        .expectOne((req) => req.url === '/platform/catalogs/identification-types')
        .flush({
          total: 1,
          items: [
            {
              id: 'i1',
              name: 'Cédula',
              abbreviation: 'CC',
              alphanumeric: false,
              kindPersonId: 'k1',
              kindPersonName: 'Natural',
              countryId: 'co',
              countryName: 'Colombia',
            },
          ],
        });
      const host = await ver(fixture, 'Cédula');
      expect(host.textContent).toContain('Numérico');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });
  });

  describe('Campos del firmante', () => {
    it('toma el primer país, no deja guardar en solo lectura', async () => {
      const fixture = abrir(SignerFieldsComponent, LEER);
      opciones();
      await vi.waitFor(() => {
        http.expectOne('/platform/catalogs/signer-policies/co').flush(politica());
      });
      const host = await ver(fixture, 'Razón social');
      expect(host.textContent).toContain('Valores por defecto');
      expect(host.textContent).not.toContain('Guardar');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('guardar envía directorio y reglas con motivo', async () => {
      const fixture = abrir(SignerFieldsComponent, GESTIONAR);
      opciones();
      await vi.waitFor(() => {
        http.expectOne('/platform/catalogs/signer-policies/co').flush(politica());
      });
      await ver(fixture, 'Guardar');
      const page = fixture.componentInstance as unknown as {
        setRule: (kind: string, field: string, rule: string) => void;
        reason: { set: (value: string) => void };
        save: () => Promise<void>;
      };
      page.setRule('natural', 'personalMail', 'required');
      page.reason.set('ajuste');
      void page.save();
      const pedido = http.expectOne(
        (req) => req.method === 'PUT' && req.url === '/platform/catalogs/signer-policies/co',
      );
      expect(pedido.request.body.reason).toBe('ajuste');
      expect(pedido.request.body.directory).toBe('ORG_ONLY');
      expect(pedido.request.body.natural.personalMail).toBe('required');
      pedido.flush(politica({ customFields: true }));
      await ver(fixture, 'Valores propios del país');
    });
  });

  describe('Inmuebles', () => {
    const catalogo = {
      propertyType: [{ key: 'casa', label: 'Casa' }],
      kitchenType: [],
      kitchenFloorType: [],
      livingRoomType: [],
      bedroomFloorType: [],
      socialAreaFloorType: [],
      otherFloorsType: [],
      garageType: [],
      consignmentType: [],
    };

    it('pinta las nueve categorías y sus valores', async () => {
      const fixture = abrir(PropertyCatalogComponent, LEER);
      http.expectOne('/platform/real-estate/catalog').flush(catalogo);
      const host = await ver(fixture, 'Casa');
      expect(host.textContent).toContain('Piso de alcobas');
      expect(host.textContent).toContain('Consignación');
      expect(host.textContent).not.toContain('Nuevo valor');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('agregar envía clave, nombre y motivo a la categoría activa', async () => {
      const fixture = abrir(PropertyCatalogComponent, GESTIONAR);
      http.expectOne('/platform/real-estate/catalog').flush(catalogo);
      await ver(fixture, 'Casa');
      const page = fixture.componentInstance as unknown as {
        add: (value: { key: string; label: string; reason: string }) => Promise<void>;
      };
      void page.add({ key: 'lote', label: 'Lote', reason: 'pedido' });
      const pedido = http.expectOne(
        (req) =>
          req.method === 'POST' && req.url === '/platform/real-estate/catalog/propertyType/items',
      );
      expect(pedido.request.body).toEqual({ key: 'lote', label: 'Lote', reason: 'pedido' });
      pedido.flush({ ...catalogo, propertyType: [...catalogo.propertyType, { key: 'lote', label: 'Lote' }] });
      await ver(fixture, 'Lote');
    });
  });

  describe('Políticas', () => {
    const vigente = {
      id: 'p1',
      code: 'terminos',
      version: 3,
      title: 'Términos',
      text: 'Texto de la política vigente',
      locale: 'es',
      publishedAt: '2026-01-15T12:00:00.000Z',
    };

    it('pinta las vigentes; solo lectura no ofrece publicar', async () => {
      const fixture = abrir(ConsentPoliciesComponent, LEER);
      http
        .expectOne((req) => req.url === '/platform/catalogs/consent-policies')
        .flush({ locale: 'es', policies: [vigente] });
      const host = await ver(fixture, 'Términos');
      expect(host.textContent).toContain('v3');
      expect(host.textContent).not.toContain('Nueva política');
      expect(host.textContent).not.toMatch(LLAVE_CRUDA);
    });

    it('cambiar de idioma vuelve a pedir la lista', async () => {
      const fixture = abrir(ConsentPoliciesComponent, GESTIONAR);
      http
        .expectOne((req) => req.url === '/platform/catalogs/consent-policies')
        .flush({ locale: 'es', policies: [vigente] });
      await ver(fixture, 'Nueva política');
      (fixture.componentInstance as unknown as { pickLocale: (l: string) => void }).pickLocale('en');
      const pedido = http.expectOne((req) => req.url === '/platform/catalogs/consent-policies');
      expect(pedido.request.params.get('locale')).toBe('en');
      pedido.flush({ locale: 'en', policies: [] });
      await ver(fixture, 'Sin políticas en este idioma');
    });
  });
});

describe('Catálogos › reglas de los formularios', () => {
  const formulario = (over: Partial<CountryFormValue> = {}): CountryFormValue => ({
    name: 'Colombia',
    abbreviation: 'CO',
    callingCode: '+57',
    currency: 'COP',
    locale: 'es-CO',
    timezone: 'America/Bogota',
    resolution: '',
    taxLabel: 'NIT',
    taxExample: '',
    taxPattern: '^[0-9]+$',
    stripCheckDigit: true,
    ...over,
  });

  it('sin cambios no envía nada', () => {
    expect(countryChangesOf(pais(), formulario())).toEqual({});
  });

  it('solo envía lo cambiado y lo vacío como null', () => {
    expect(countryChangesOf(pais(), formulario({ currency: '', name: ' Colombia 2 ' }))).toEqual({
      name: 'Colombia 2',
      currency: null,
    });
  });

  it('vaciar la identificación tributaria la borra', () => {
    expect(
      countryChangesOf(
        pais(),
        formulario({ taxLabel: '', taxPattern: '', stripCheckDigit: false }),
      ),
    ).toEqual({ taxId: null });
  });

  it('los documentos se normalizan y no se repiten', () => {
    expect(parseDocTypes(' cc, CE ,cc,, ')).toEqual(['CC', 'CE']);
  });

  it('la clave del inmueble sale del nombre sin tildes', () => {
    expect(slugOf('  Baldosa de Cerámica ')).toBe('baldosa_de_ceramica');
  });
});
