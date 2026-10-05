export interface AuthUser {
  id: string;
  names: string;
  surNames: string;
  email: string;
  identification: string;
  imageProfile: string | null;
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub?: string;
  userId?: string;
  orgId?: string;
  permissions?: string[];
  platformStaff?: boolean;
  platformPermissions?: string[];
  exp: number;
  iat: number;
}

export interface MeMembership {
  organizationId: string;
  organizationName?: string;
  roleCode: number | null;
  roleName?: string;
  active: boolean;
  suspended?: boolean;
}

export interface Me {
  user: {
    id: string;
    names: string;
    surNames: string;
    email: string;
    identification: string;
    imageProfile?: string | null;
  };
  permissions: string[];
  memberships: MeMembership[];
  platformStaff?: boolean;
  platformPermissions?: string[];
}

export interface RequestOtpResult {
  sent: boolean;
  channels?: { email?: string; phone?: string };
  expiresAt?: string;
  resendAfterSeconds?: number;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  sid: string;
  expiresIn: number;
}
