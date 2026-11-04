import { ficha } from '../pages/signers-test-kit';
import { changesOf, type SignerFormValue } from './signer-edit-form.component';

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
