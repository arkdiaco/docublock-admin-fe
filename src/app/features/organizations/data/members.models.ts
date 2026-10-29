export interface OrgMember {
  userId: string;
  names: string;
  surNames: string;
  identification: string;
  email: string;
  phone?: string;
  state: number;
  roleId: string;
  roleCode?: number;
  roleName?: string;
}

export interface OrgRole {
  id: string;
  name: string;
  code: number;
  description: string;
  isSystem: boolean;
  permissions: number;
}

export type InvitationState = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface OrgInvitation {
  id: string;
  identification: string;
  email: string;
  roleId: string;
  state: InvitationState;
  expiresAt: string;
  createdAt?: string;
}

export interface Paged<T> {
  total: number;
  items: T[];
}

export interface InviteBody {
  identification: string;
  email: string;
  roleId: string;
  reason: string;
}

export interface RoleSyncReport {
  created: number;
  existing: number;
  rolesWithDerived: number;
}

export const ADMIN_ROLE_CODE = 1;
