import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth.api';
import type { Me, RequestOtpResult } from './auth.models';
import { AuthStore } from './auth.store';

export class NotPlatformStaffError extends Error {
  constructor() {
    super('NOT_PLATFORM_STAFF');
    this.name = 'NotPlatformStaffError';
  }
}

export const LOGIN_ROUTE = '/acceso';
export const HOME_ROUTE = '/panel';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(AuthApi);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly _leaving = signal(false);

  readonly leaving = this._leaving.asReadonly();

  requestCode(email: string, resend = false): Promise<RequestOtpResult> {
    return firstValueFrom(this.api.requestOtp({ email, resend }));
  }

  async loginWithCode(email: string, code: string): Promise<void> {
    const session = await firstValueFrom(this.api.login({ email, code }));
    this.store.setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    const me = await this.loadProfile();
    if (!isPlatformStaff(me)) {
      await this.dropSession();
      throw new NotPlatformStaffError();
    }
  }

  async loadProfile(): Promise<Me> {
    const me = await firstValueFrom(this.api.me());
    this.store.setProfile({
      user: {
        id: me.user.id,
        names: me.user.names,
        surNames: me.user.surNames,
        email: me.user.email,
        identification: me.user.identification,
        imageProfile: me.user.imageProfile ?? null,
      },
      platformStaff: isPlatformStaff(me),
      platformPermissions: me.platformPermissions ?? [],
    });
    return me;
  }

  async restore(): Promise<void> {
    if (!this.store.isAuthenticated()) return;
    try {
      const me = await this.loadProfile();
      if (!isPlatformStaff(me)) this.store.clear();
    } catch {
      this.store.clear();
    }
  }

  async logout(): Promise<void> {
    this._leaving.set(true);
    try {
      await this.dropSession();
      await this.router.navigate([LOGIN_ROUTE]);
    } finally {
      this._leaving.set(false);
    }
  }

  private async dropSession(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } catch {
      return;
    } finally {
      this.store.clear();
    }
  }
}

export const isPlatformStaff = (me: Me): boolean => me.platformStaff === true;
