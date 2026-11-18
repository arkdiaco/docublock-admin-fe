import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PlatformSignerDetail } from '../data/signers.models';
import { configurar, ficha } from '../pages/signers-test-kit';
import {
  changesOf,
  SignerEditFormComponent,
  type SignerFormValue,
} from './signer-edit-form.component';

const sinCambios = (): SignerFormValue => ({
  firstName: 'Ana',
  lastName: 'Ruiz',
  businessName: '',
  email: 'ana@correo.co',
  personalMail: '',
  cellphone: '+573001112233',
  expeditionDate: '2010-05-20',
  birthDate: '',
  countryId: 'co',
  kindPersonId: 'nat',
  identificationTypeId: 'cc',
  expeditionCityId: 'bog',
});

describe('Firmantes › Formulario de datos', () => {
  it('sin cambios no manda nada', () => {
    expect(changesOf(ficha(), sinCambios())).toEqual({});
  });

  it('manda solo lo que cambió y recortado', () => {
    expect(changesOf(ficha(), { ...sinCambios(), firstName: ' Ana María ' })).toEqual({
      firstName: 'Ana María',
    });
  });

  it('vaciar un dato opcional manda null', () => {
    const changes = changesOf(ficha({ personalMail: 'a@b.co', birthDate: '1990-01-02T00:00:00.000Z' }), {
      ...sinCambios(),
      expeditionDate: '',
      expeditionCityId: null,
    });
    expect(changes).toEqual({
      personalMail: null,
      birthDate: null,
      expeditionDate: null,
      expeditionCityId: null,
    });
  });

  it('un firmante sin selecciones no manda selectores vacíos', () => {
    const signer = ficha({
      countryId: undefined,
      kindPersonId: undefined,
      identificationTypeId: undefined,
      expeditionCityId: undefined,
    });
    expect(
      changesOf(signer, {
        ...sinCambios(),
        countryId: null,
        kindPersonId: null,
        identificationTypeId: null,
        expeditionCityId: null,
      }),
    ).toEqual({});
  });

  it('poner el país manda también el tipo de documento que ya tenía', () => {
    const signer = ficha({ countryId: undefined, kindPersonId: undefined });
    expect(changesOf(signer, sinCambios())).toEqual({
      countryId: 'co',
      kindPersonId: 'nat',
      identificationTypeId: 'cc',
    });
  });

  it('cambiar de país manda el país con su catálogo', () => {
    expect(
      changesOf(ficha(), {
        ...sinCambios(),
        countryId: 'ec',
        kindPersonId: 'nat-ec',
        identificationTypeId: 'ci',
        expeditionCityId: null,
      }),
    ).toEqual({
      countryId: 'ec',
      kindPersonId: 'nat-ec',
      identificationTypeId: 'ci',
      expeditionCityId: null,
    });
  });
});

describe('Firmantes › Formulario con datos incompletos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const tipos = [
    { id: 'cc', name: 'Cédula', kindPersonId: 'nat' },
    { id: 'nit', name: 'NIT', kindPersonId: 'jur' },
  ];
  const personas = [
    { id: 'nat', name: 'Natural' },
    { id: 'jur', name: 'Jurídica' },
  ];

  const abrir = (signer: PlatformSignerDetail) => {
    const fixture = TestBed.createComponent(SignerEditFormComponent);
    fixture.componentRef.setInput('signer', signer);
    fixture.detectChanges();
    return fixture;
  };

  const responder = (pais = 'co'): void => {
    http.match('/catalogs/countries').forEach((r) => r.flush([{ id: pais, name: 'Colombia' }]));
    http.match(`/catalogs/countries/${pais}/kind-persons`).forEach((r) => r.flush(personas));
    http.match(`/catalogs/countries/${pais}/identification-types`).forEach((r) => r.flush(tipos));
    http.match((r) => r.url === `/catalogs/countries/${pais}/cities`).forEach((r) => r.flush([]));
  };

  const host = (fixture: ReturnType<typeof abrir>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  const texto = async (
    fixture: ReturnType<typeof abrir>,
    esperado: (host: string) => void,
  ): Promise<void> => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      esperado(host(fixture));
    });
  };

  it('sin país muestra el tipo de documento que ya tiene', async () => {
    const fixture = abrir(
      ficha({ countryId: undefined, kindPersonId: undefined, kindPersonName: undefined }),
    );
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    await texto(fixture, (host) => expect(host).toContain('Cédula'));
  });

  it('sin tipo de persona lo toma del tipo de documento', async () => {
    const fixture = abrir(ficha({ kindPersonId: undefined, kindPersonName: undefined }));
    responder();
    await texto(fixture, (host) => expect(host).toContain('Natural'));
    expect(host(fixture)).toContain('Cédula');
  });

  it('un tipo de documento de otro tipo de persona igual se muestra', async () => {
    const fixture = abrir(ficha({ identificationTypeId: 'nit', identificationTypeName: 'NIT' }));
    responder();
    await texto(fixture, (host) => expect(host).toContain('NIT'));
  });

  it('elegir el país conserva la cédula si existe allí', async () => {
    const fixture = abrir(
      ficha({ countryId: undefined, kindPersonId: undefined, kindPersonName: undefined }),
    );
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    fixture.componentInstance['pickCountry']('co');
    responder();
    await texto(fixture, (host) => {
      expect(host).toContain('Cédula');
      expect(host).toContain('Natural');
    });
    expect(host(fixture)).not.toContain('Elige el tipo de persona y el tipo de documento');
  });

  it('con cambios y sin motivo dice por qué no se puede guardar', async () => {
    const fixture = abrir(ficha());
    responder();
    fixture.componentInstance['firstName'].set('Ana María');
    await texto(fixture, (host) => expect(host).toContain('Escribe el motivo'));
    fixture.componentInstance['reason'].set('Corrige el nombre');
    await texto(fixture, (host) => expect(host).not.toContain('Escribe el motivo'));
  });

});
