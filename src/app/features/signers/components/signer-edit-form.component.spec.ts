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
  identification: '1032456789',
  identificationRepLegal: '',
  identificationTypeRepLegalId: null,
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

describe('Firmantes › Formulario: número de documento', () => {
  it('manda el número nuevo recortado', () => {
    expect(changesOf(ficha(), { ...sinCambios(), identification: ' 1032456780 ' })).toEqual({
      identification: '1032456780',
    });
  });

  it('el mismo número con espacios o vacío no se manda', () => {
    expect(changesOf(ficha(), { ...sinCambios(), identification: ' 1032456789 ' })).toEqual({});
    expect(changesOf(ficha(), { ...sinCambios(), identification: '  ' })).toEqual({});
  });

  it('manda el número y el tipo del representante legal; vaciar el número manda null', () => {
    const empresa = ficha({ identificationRepLegal: '52111', identificationTypeRepLegalId: 'cc' });
    expect(
      changesOf(empresa, {
        ...sinCambios(),
        identificationRepLegal: ' 52999 ',
        identificationTypeRepLegalId: 'ce',
      }),
    ).toEqual({ identificationRepLegal: '52999', identificationTypeRepLegalId: 'ce' });
    expect(
      changesOf(empresa, {
        ...sinCambios(),
        identificationRepLegal: '',
        identificationTypeRepLegalId: 'cc',
      }),
    ).toEqual({ identificationRepLegal: null });
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

  const cambiarNumero = (fixture: ReturnType<typeof abrir>, numero: string): void => {
    fixture.componentInstance['identification'].set(numero);
    fixture.detectChanges();
  };

  it('cambiar el número avisa a quién afecta, sin bloquear', async () => {
    const fixture = abrir(ficha());
    responder();
    cambiarNumero(fixture, '1032456780');
    const impacto = await vi.waitFor(() =>
      http.expectOne('/platform/signers/s1/identification-impact'),
    );
    impacto.flush({ usersWithNumber: 2, legalRepCompanies: 1, documentsInProgress: 3 });
    await texto(fixture, (host) => {
      expect(host).toContain('2 usuarios de organizaciones entran con el número anterior');
      expect(host).toContain('1 empresa lo tiene como representante legal');
      expect(host).toContain('3 documentos en curso');
      expect(host).toContain('los documentos ya firmados siguen verificados');
    });
    fixture.componentInstance['reason'].set('Número mal digitado');
    fixture.detectChanges();
    expect(fixture.componentInstance['canSave']()).toBe(true);
    cambiarNumero(fixture, '1032456781');
    http.expectNone('/platform/signers/s1/identification-impact');
  });

  it('sin nadie afectado solo dice que el número anterior queda en el historial', async () => {
    const fixture = abrir(ficha());
    responder();
    cambiarNumero(fixture, '1032456780');
    (await vi.waitFor(() => http.expectOne('/platform/signers/s1/identification-impact'))).flush({
      usersWithNumber: 0,
      legalRepCompanies: 0,
      documentsInProgress: 0,
    });
    await texto(fixture, (host) =>
      expect(host).toContain('los documentos ya firmados siguen verificados'),
    );
    expect(host(fixture)).not.toContain('usuarios de organizaciones');
    expect(host(fixture)).not.toContain('documentos en curso');
  });

  it('vaciar el número dice por qué no se puede guardar', async () => {
    const fixture = abrir(ficha());
    responder();
    cambiarNumero(fixture, ' ');
    fixture.componentInstance['reason'].set('Prueba');
    await texto(fixture, (host) => expect(host).toContain('Escribe el número de documento'));
    expect(fixture.componentInstance['canSave']()).toBe(false);
  });

  it('en persona jurídica pide el documento del representante legal; en natural no', async () => {
    const natural = abrir(ficha());
    responder();
    await texto(natural, (host) => expect(host).toContain('Natural'));
    expect(host(natural)).not.toContain('Número del representante legal');
    natural.destroy();
    const empresa = abrir(
      ficha({
        kindPersonId: 'jur',
        kindPersonName: 'Jurídica',
        identificationTypeId: 'nit',
        identificationTypeName: 'NIT',
        identificationRepLegal: '52111',
        identificationTypeRepLegalId: 'cc',
      }),
    );
    http.match('/catalogs/countries').forEach((r) => r.flush([{ id: 'co', name: 'Colombia' }]));
    http
      .match('/catalogs/countries/co/kind-persons')
      .forEach((r) => r.flush([
        { id: 'nat', name: 'Natural', type: 'natural' },
        { id: 'jur', name: 'Jurídica', type: 'legal' },
      ]));
    http.match('/catalogs/countries/co/identification-types').forEach((r) => r.flush(tipos));
    http.match((r) => r.url === '/catalogs/countries/co/cities').forEach((r) => r.flush([]));
    await texto(empresa, (host) => {
      expect(host).toContain('Número del representante legal');
      expect(host).toContain('Tipo de documento del representante legal');
    });
    expect(empresa.componentInstance['identificationRepLegal']()).toBe('52111');
    expect(empresa.componentInstance['repLegalTypes']().map((t) => t.id)).toEqual(['cc']);
  });

  it('si el número ya es de otro firmante ofrece abrirlo', async () => {
    const fixture = abrir(ficha());
    responder();
    fixture.componentRef.setInput('duplicateOf', 's7');
    await texto(fixture, (host) => expect(host).toContain('Ese número ya es de otro firmante'));
    const enlace = (fixture.nativeElement as HTMLElement).querySelector('a[href*="s7"]');
    expect(enlace?.textContent).toContain('Abrir ese firmante');
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
