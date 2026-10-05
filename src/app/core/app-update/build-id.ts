const MAIN_BUNDLE = /main-([A-Z0-9]{8})\.js/;
const STALE_CHUNK = /dynamically imported module|Importing a module script failed|ChunkLoadError/i;

export const buildIdOf = (html: string): string | null => MAIN_BUNDLE.exec(html)?.[1] ?? null;

export const isStaleChunkError = (error: unknown): boolean => {
  const message = error instanceof Error ? `${error.name} ${error.message}` : typeof error === 'string' ? error : '';
  return STALE_CHUNK.test(message);
};
