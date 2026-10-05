import type { HttpResponse } from '@angular/common/http';

export interface ExportedFile {
  filename: string;
  blob: Blob;
}

const FILENAME = /filename="([^"]+)"/;

export const exportedFileOf = (response: HttpResponse<Blob>, fallback: string): ExportedFile => ({
  filename: FILENAME.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallback,
  blob: response.body ?? new Blob(),
});
