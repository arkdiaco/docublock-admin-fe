import { quotaRows } from './quota-rows';
import type { QuotaNode, QuotaTree } from './quotas.models';

const nodo = (
  id: string,
  categoryType: QuotaNode['categoryType'],
  parentIds: string[] = [],
): QuotaNode => ({
  id,
  name: id,
  categoryType,
  quotaAssigned: 0,
  quotaConsumed: 0,
  quotaAvailable: 0,
  numberOfTransactions: 0,
  parentIds,
  minQuota: 0,
  maxQuota: null,
});

describe('quotaRows', () => {
  it('pone cada rama debajo de su padre y deja las huérfanas en su nivel', () => {
    const tree = {
      organization: {} as QuotaTree['organization'],
      regions: [nodo('norte', 'region'), nodo('sur', 'region')],
      subsidiaries: [
        nodo('sede-sur', 'subsidiary', ['sur']),
        nodo('sede-norte', 'subsidiary', ['norte']),
        nodo('suelta', 'subsidiary', ['x']),
      ],
      orgAreas: [nodo('ventas', 'orgArea', ['sede-norte'])],
      subAreas: [],
    } as QuotaTree;
    expect(quotaRows(tree).map((r) => `${r.depth}:${r.id}`)).toEqual([
      '0:norte',
      '1:sede-norte',
      '2:ventas',
      '0:sur',
      '1:sede-sur',
      '1:suelta',
    ]);
  });
});
