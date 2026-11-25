import type { InactiveExportView, InactiveRowExport } from './inactive-clients.models';

export type ExportStage = 'none' | 'running' | 'ready' | 'expired' | 'failed';

export const exportStageOf = (view: InactiveExportView | null): ExportStage => {
  if (!view) return 'none';
  if (view.state === 'running') return 'running';
  if (view.state === 'failed') return 'failed';
  return view.expired || !view.url ? 'expired' : 'ready';
};

export const rowExportStageOf = (row: InactiveRowExport | null): ExportStage => {
  if (!row) return 'none';
  if (row.state === 'running') return 'running';
  if (row.state === 'failed') return 'failed';
  return row.expired ? 'expired' : 'ready';
};

export const exportPercentOf = (view: InactiveExportView): number =>
  view.total === 0 ? 0 : Math.min(100, Math.floor((view.processed / view.total) * 100));

export const exportBytesOf = (view: InactiveExportView): number =>
  view.parts.reduce((sum, part) => sum + part.bytes, 0);

export const exportDocumentsOf = (view: InactiveExportView): number =>
  view.parts.reduce((sum, part) => sum + part.documents, 0);

export const megabytesOf = (bytes: number): number => Math.round((bytes / 1048576) * 10) / 10;
