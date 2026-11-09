export interface OverviewMonth {
  month: number;
  documents: { created: number; signed: number };
  transactions: { total: number; approved: number };
}

export interface PlanShare {
  code: string | null;
  name: string;
  count: number;
}

export interface PlatformOverview {
  year: number;
  firstYear: number;
  timeZone: string;
  users: number;
  organizations: { total: number; clients: number; resellers: number };
  documents: { created: number; signed: number };
  transactions: { total: number; approved: number };
  months: OverviewMonth[];
  plans: PlanShare[];
}
