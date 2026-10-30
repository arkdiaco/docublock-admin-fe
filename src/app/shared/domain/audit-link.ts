export const AUDIT_FILTER_PARAM = 'filtro';

export const organizationAuditFilter = (organizationId: string): string => `org:${organizationId}`;

export const emailHandle = (email?: string): string => (email ?? '').split('@')[0];
