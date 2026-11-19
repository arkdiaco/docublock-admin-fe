export const ORG_LANGUAGES: readonly string[] = ['es', 'en'];

export const orgLanguageKeyOf = (language?: string | null): string | null => {
  const code = (language ?? '').trim().toLowerCase();
  return ORG_LANGUAGES.includes(code) ? `orgEdit.lang.${code}` : null;
};
