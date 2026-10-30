export type TicketStatus =
  'open' | 'pending' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'critical';

export type TicketCategory =
  'signature' | 'identity_validation' | 'documents' | 'billing' | 'account' | 'technical' | 'other';

export type TicketChannel = 'signature_flow' | 'platform' | 'admin';

export type SupportAuthorType = 'signer' | 'user' | 'agent' | 'system';

export const TICKET_STATUSES: readonly TicketStatus[] = [
  'open',
  'pending',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
];

export const OPEN_STATUSES: readonly TicketStatus[] = [
  'open',
  'pending',
  'in_progress',
  'waiting_customer',
];

export const TICKET_PRIORITIES: readonly TicketPriority[] = ['critical', 'high', 'normal', 'low'];

export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  'signature',
  'identity_validation',
  'documents',
  'billing',
  'account',
  'technical',
  'other',
];

export const TICKET_CHANNELS: readonly TicketChannel[] = ['platform', 'signature_flow', 'admin'];

export interface NamedRef {
  id: string;
  name?: string;
}

export interface TicketSla {
  policyId?: string;
  policyName: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  organizationId?: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  sourceChannel: TicketChannel;
  createdByType: SupportAuthorType;
  createdById?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  signerId?: string;
  documentId?: string;
  assignedToId?: string;
  sla: TicketSla;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  organization: NamedRef | null;
  assignee: NamedRef | null;
}

export interface TicketMessage {
  authorType: SupportAuthorType;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  body: string;
  attachments: string[];
  internalNote: boolean;
  createdAt: string;
}

export type TicketAuditAction =
  | 'created'
  | 'first_response'
  | 'message_added'
  | 'status_change'
  | 'priority_change'
  | 'assignment'
  | 'reopened'
  | 'resolved'
  | 'closed';

export interface TicketAuditEntry {
  action: TicketAuditAction;
  byType: SupportAuthorType;
  byId?: string;
  byName?: string;
  from: string | null;
  to: string | null;
  createdAt: string;
}

export interface TicketAssignment {
  assignedToId: string;
  assignedById?: string;
  assignedToName?: string;
  assignedByName?: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
  auditLog: TicketAuditEntry[];
  assignmentHistory: TicketAssignment[];
}

export interface TicketsPage {
  total: number;
  items: TicketSummary[];
}

export interface TicketsQuery {
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  sourceChannel?: TicketChannel;
  organizationId?: string;
  assignedToId?: string;
  unassigned?: boolean;
  open?: boolean;
  breached?: boolean;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface TicketMetrics {
  total: number;
  open: number;
  unassignedOpen: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  firstResponseBreached: number;
  resolutionBreached: number;
  overdueFirstResponse: number;
  overdueResolution: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
}

export interface SlaRule {
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export type SlaMatrix = Record<TicketPriority, SlaRule>;

export interface SlaPolicy {
  id: string;
  name: string;
  planId?: string;
  isDefault: boolean;
  active: boolean;
  matrix: Partial<Record<string, unknown>>;
  createdAt?: string;
}

export interface SlaPolicyBody {
  name: string;
  planId?: string | null;
  isDefault: boolean;
  active: boolean;
  matrix: SlaMatrix;
}

export interface SlaPlanOption {
  id: string;
  name: string;
  plansLinked: string[];
}
