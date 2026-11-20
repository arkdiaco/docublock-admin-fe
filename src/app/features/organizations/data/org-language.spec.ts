import en from '../../../../../public/i18n/en.json';
import es from '../../../../../public/i18n/es.json';
import { ORG_LANGUAGES, orgLanguageKeyOf } from './org-language';

describe('Organizaciones: idioma', () => {
  it('el idioma guardado se lee sin importar mayúsculas ni espacios', () => {
    expect(orgLanguageKeyOf('es')).toBe('orgEdit.lang.es');
    expect(orgLanguageKeyOf('ES')).toBe('orgEdit.lang.es');
    expect(orgLanguageKeyOf(' En ')).toBe('orgEdit.lang.en');
  });

  it('un idioma sin frase o vacío no arma llave', () => {
    expect(orgLanguageKeyOf('fr')).toBeNull();
    expect(orgLanguageKeyOf('')).toBeNull();
    expect(orgLanguageKeyOf(undefined)).toBeNull();
  });

  it('cada idioma tiene frase en los dos catálogos', () => {
    for (const code of ORG_LANGUAGES) {
      expect(typeof (es.orgEdit.lang as Record<string, unknown>)[code]).toBe('string');
      expect(typeof (en.orgEdit.lang as Record<string, unknown>)[code]).toBe('string');
    }
  });
});
