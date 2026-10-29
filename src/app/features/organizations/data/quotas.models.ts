export type CategoryType = 'region' | 'subsidiary' | 'orgArea' | 'subArea';

export const CATEGORY_TYPES: readonly CategoryType[] = [
  'region',
  'subsidiary',
  'orgArea',
  'subArea',
];

export interface QuotaNode {
  id: string;
  name: string;
  categoryType: CategoryType;
  quotaAssigned: number;
  quotaConsumed: number;
  quotaAvailable: number;
  numberOfTransactions: number;
  parentIds: string[];
  minQuota: number;
  maxQuota: number | null;
}

export interface QuotaTree {
  organization: {
    id: string;
    businessName: string;
    subscribed: boolean;
    totalPlanDocuments: number | null;
    remainingDocuments: number | null;
    totalAssignedToCategories: number;
    unassignedPool: number | null;
  };
  regions: QuotaNode[];
  subsidiaries: QuotaNode[];
  orgAreas: QuotaNode[];
  subAreas: QuotaNode[];
}

export interface QuotaHistoryEntry {
  id: string;
  action: string;
  sourceCategoryName?: string;
  destCategoryName?: string;
  amount: number;
  previousValue?: number;
  newValue?: number;
  createdAt?: string;
  actor?: { userId: string; names?: string; email?: string };
}

export interface QuotaHistoryPage {
  total: number;
  items: QuotaHistoryEntry[];
}

export interface QuotaRow extends QuotaNode {
  depth: number;
}

export interface AssignQuotaBody {
  categoryType: CategoryType;
  categoryId: string;
  quota: number;
  reason: string;
}

export interface TransferQuotaBody {
  sourceCategoryType: CategoryType;
  sourceCategoryId: string;
  destCategoryType: CategoryType | 'organization';
  destCategoryId?: string;
  amount: number;
  reason: string;
}
