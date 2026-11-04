import { ficha } from '../pages/users-test-kit';
import { changesOf } from './user-edit-form.component';

const base = () => ({
  names: 'Ana',
  surNames: 'Pérez Gómez',
  email: 'ana@correo.co',
  phone: '3001112233',
  expeditionDate: '2010-05-20',
  countryId: 'co' as string | null,
  cityId: 'c1' as string | null,
});

describe('Datos del usuario › solo lo cambiado', () => {
  it('sin cambios no envía nada', () => {
    expect(changesOf(ficha(), base())).toEqual({});
  });

  it('editar el nombre no envía el celular viejo que ya no cumple el formato', () => {
    expect(changesOf(ficha(), { ...base(), names: 'Ana María' })).toEqual({ names: 'Ana María' });
  });

  it('recorta espacios antes de comparar', () => {
    expect(changesOf(ficha(), { ...base(), email: ' ana@correo.co ' })).toEqual({});
  });

  it('cambiar de país lleva país y ciudad', () => {
    expect(changesOf(ficha(), { ...base(), countryId: 'pe', cityId: 'c2' })).toEqual({
      countryId: 'pe',
      cityId: 'c2',
    });
  });
});
