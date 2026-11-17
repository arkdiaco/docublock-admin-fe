import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { errorCodeOf, errorMessageOf } from '../../../shared/http/error-code';
import { PlansApi } from './plans.api';
import type { PlanStripeSync } from './plans.models';
import type { StripeSyncResult } from './stripe-sync-view';

export const PUBLISH_ERRORS: readonly string[] = [
  'PLAN_SIN_STRIPE',
  'PLAN_RETIRADO',
  'STRIPE_PAR_INCOMPLETO',
  'STRIPE_PRECIO_DISTINTO',
  'STRIPE_PRECIO_EN_USO',
  'STRIPE_NO_DISPONIBLE',
];

@Injectable({ providedIn: 'root' })
export class StripeSyncRunner {
  private readonly api = inject(PlansApi);
  private readonly translate = inject(TranslateService);

  async publishAll(plans: readonly PlanStripeSync[], reason: string): Promise<StripeSyncResult[]> {
    const results: StripeSyncResult[] = [];
    for (const plan of plans) {
      results.push(await this.publishOne(plan, reason));
    }
    return results;
  }

  private async publishOne(plan: PlanStripeSync, reason: string): Promise<StripeSyncResult> {
    const base = { code: plan.code, name: plan.name };
    try {
      await firstValueFrom(this.api.publishStripe(plan.code, reason));
      return { ...base, ok: true, message: '' };
    } catch (failure) {
      return { ...base, ok: false, message: this.messageOf(failure) };
    }
  }

  private messageOf(failure: unknown): string {
    const code = errorCodeOf(failure);
    if (code && PUBLISH_ERRORS.includes(code)) {
      const body =
        failure instanceof HttpErrorResponse
          ? (failure.error as Record<string, unknown> | null)
          : null;
      return this.translate.instant(`plans.error.${code}`, {
        plan: String(body?.['plan'] ?? ''),
      }) as string;
    }
    return errorMessageOf(failure) ?? (this.translate.instant('plans.error.generic') as string);
  }
}
