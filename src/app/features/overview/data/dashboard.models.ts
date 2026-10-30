export interface DashboardOrgRef {
  id: string;
  businessName: string;
  tributaryNumber: string;
}

export interface QuotaAction {
  organization: DashboardOrgRef;
  used: number;
  limit: number;
}

export interface ExpiringAction {
  organization: DashboardOrgRef;
  daysLeft: number;
  periodEnd: string | null;
}

export interface DocumentIssueAction {
  issue: 'UNREGISTERED_BLOCKCHAIN' | 'STUCK_COMPLETED';
  count: number;
}

export interface TicketAction {
  ticket: { id: string; ticketNumber: string; subject: string };
  organization: { id: string; name?: string } | null;
}

export type DashboardActionGroup =
  | { kind: 'QUOTA_EXHAUSTED' | 'QUOTA_WARNING'; total: number; items: QuotaAction[] }
  | { kind: 'SUBSCRIPTION_EXPIRING'; total: number; items: ExpiringAction[] }
  | { kind: 'TICKET_OVERDUE'; total: number; items: TicketAction[] }
  | { kind: 'DOCUMENT_ISSUE'; total: number; items: DocumentIssueAction[] };

export type DashboardActionKind = DashboardActionGroup['kind'];

export interface DashboardEvent {
  id: string;
  action: string;
  admin: { id: string; name?: string };
  target: { type: string; id?: string; label?: string };
  organization?: { id: string; name?: string };
  createdAt?: string;
}

export interface MonthRevenue {
  currency: string | null;
  gross: number;
  previousGross: number;
  otherCurrencies: number;
}

export interface PlatformDashboard {
  generatedAt: string;
  organizations: { total: number; createdThisMonth: number };
  activeUsers: { last30Days: number };
  revenue: MonthRevenue | null;
  warnings: { total: number; exhausted: number };
  actions: DashboardActionGroup[];
  activity: DashboardEvent[] | null;
}
