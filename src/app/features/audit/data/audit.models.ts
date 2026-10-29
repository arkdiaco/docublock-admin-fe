export interface AuditActor {
  id: string;
  email?: string;
  name?: string;
}

export interface AuditRow {
  id: string;
  action: string;
  admin: AuditActor;
  target: { type: string; id?: string; label?: string };
  organization?: { id: string; name?: string };
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
  userAgent?: string;
  createdAt?: string;
}

export interface AuditPage {
  total: number;
  items: AuditRow[];
}

export interface AuditFacets {
  actions: string[];
  admins: AuditActor[];
}

export interface AuditFilters {
  adminId?: string;
  organizationId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

export interface AuditQuery extends AuditFilters {
  page: number;
  limit: number;
}
