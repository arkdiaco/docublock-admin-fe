export type StaffRole = 'superadmin' | 'support' | 'readonly';

export type StaffStatus = 'ACTIVE' | 'SUSPENDED';

export const STAFF_ROLES: readonly StaffRole[] = ['superadmin', 'support', 'readonly'];

export interface StaffMember {
  id: string;
  email: string;
  names: string;
  surNames: string;
  role: StaffRole;
  status: StaffStatus;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string | null;
  activeSessions: number;
  isSelf: boolean;
}

export interface StaffList {
  items: StaffMember[];
}

export interface GrantAccess {
  email: string;
  names: string;
  surNames: string;
  role: StaffRole;
}

export interface StaffChange {
  role?: StaffRole;
  status?: StaffStatus;
  reason?: string;
}

export interface StaffRemoval {
  id: string;
  removed: true;
  revokedSessions: number;
}
