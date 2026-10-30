export interface OrgAuditEvent {
  id: string;
  action: string;
  admin: { id: string; email?: string; name?: string };
  reason?: string;
  createdAt?: string;
}

export interface OrgAuditPage {
  total: number;
  items: OrgAuditEvent[];
}
