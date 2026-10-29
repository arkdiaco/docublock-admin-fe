import type { QuotaNode, QuotaRow, QuotaTree } from './quotas.models';

export const quotaRows = (tree: QuotaTree): QuotaRow[] => {
  const levels = [tree.regions, tree.subsidiaries, tree.orgAreas, tree.subAreas];
  const placed = new Set<string>();
  const rows: QuotaRow[] = [];
  const visit = (node: QuotaNode, depth: number): void => {
    if (placed.has(node.id)) return;
    placed.add(node.id);
    rows.push({ ...node, depth });
    for (const child of levels[depth + 1] ?? []) {
      if (child.parentIds.includes(node.id)) visit(child, depth + 1);
    }
  };
  levels.forEach((level, depth) => {
    for (const node of level) visit(node, depth);
  });
  return rows;
};

export const transferable = (row: Pick<QuotaRow, 'quotaAssigned' | 'minQuota'>): number =>
  Math.max(0, row.quotaAssigned - row.minQuota);
