const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
];

const firstMatch = (agent: string, table: readonly (readonly [RegExp, string])[]): string | null =>
  table.find(([pattern]) => pattern.test(agent))?.[1] ?? null;

export const deviceLabel = (agent: string | null | undefined): string | null => {
  if (!agent) return null;
  const parts = [firstMatch(agent, BROWSERS), firstMatch(agent, SYSTEMS)].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : agent;
};
