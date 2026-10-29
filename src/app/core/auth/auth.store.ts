import { Injectable, computed, inject, signal } from '@angular/core';
import { canManageGroup, canReadGroup, type PlatformGroup } from '../../shared/domain/platform-permissions';
import { jwtDecode } from 'jwt-decode';
import type { AuthUser, JwtPayload, StoredSession } from './auth.models';
import { SessionStorage } from './session.storage';

const claims = (token: string | null): JwtPayload | null => {
  if (!token) return null;
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _platformStaff = signal<boolean | null>(null);
  private readonly _platformPermissions = signal<string[]>([]);
  private readonly _platformRole = signal<string | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly platformPermissions = this._platformPermissions.asReadonly();
  readonly platformRole = this._platformRole.asReadonly();

  readonly isAuthenticated = computed(() => this._accessToken() !== null);
  readonly profileLoaded = computed(() => this._user() !== null);

  readonly platformStaff = computed<boolean>(() => {
    const known = this._platformStaff();
    if (known !== null) return known;
    return claims(this._accessToken())?.platformStaff === true;
  });

  readonly displayName = computed(() => {
    const user = this._user();
    if (!user) return '';
    return `${user.names} ${user.surNames}`.trim() || user.email;
  });

  readonly initials = computed(() => {
    const user = this._user();
    if (!user) return '';
    const first = user.names?.[0] ?? '';
    const last = user.surNames?.[0] ?? '';
    return (first + last).toUpperCase() || (user.email?.[0] ?? '').toUpperCase();
  });

  private readonly storage = inject(SessionStorage);

  constructor() {
    const stored = this.storage.read();
    if (stored) {
      this._accessToken.set(stored.accessToken);
      this._refreshToken.set(stored.refreshToken);
    }
  }

  hasPlatformPermission(permission: string): boolean {
    return this._platformPermissions().includes(permission);
  }

  hasAnyPlatformPermission(permissions: string[]): boolean {
    const owned = this._platformPermissions();
    return permissions.some((p) => owned.includes(p));
  }

  canRead(group: PlatformGroup): boolean {
    return canReadGroup(this._platformPermissions(), group);
  }

  canManage(group: PlatformGroup): boolean {
    return canManageGroup(this._platformPermissions(), group);
  }

  setTokens(session: StoredSession): void {
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken);
    this.storage.write(session);
  }

  refreshTokenValue(): string | null {
    return this._refreshToken();
  }

  setProfile(input: { user: AuthUser; platformStaff: boolean; platformPermissions: string[]; platformRole?: string | null }): void {
    this._user.set(input.user);
    this._platformStaff.set(input.platformStaff);
    this._platformPermissions.set(input.platformPermissions);
    this._platformRole.set(input.platformRole ?? null);
  }

  clear(): void {
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    this._platformStaff.set(null);
    this._platformPermissions.set([]);
    this._platformRole.set(null);
    this.storage.clear();
  }
}
