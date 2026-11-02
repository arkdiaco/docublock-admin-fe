import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { PromoReportComponent } from '../components/promo-report.component';
import { ReferralFormComponent } from '../components/referral-form.component';
import { PromotionsApi } from '../data/promotions.api';
import { CODE_FAMILY, PROMO_ERRORS, codeStateOf } from '../data/promotions-view';
import type { Referral, UpdateReferralBody } from '../data/promotions.models';
import { initialsOf } from '../../../shared/domain/initials';

@Component({
  selector: 'dba-referral-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    UsageMeterComponent,
    PromoReportComponent,
    ReferralFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'ref.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="ref.detail.missingTitle" leadKey="ref.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'ref.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="ref.detail.errorTitle" leadKey="ref.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (referral(); as item) {
      <div class="bd">
        <dba-record-header
          [initials]="initials()"
          [title]="item.name"
          [state]="item.active ? 'active' : 'closed'"
          [stateLabelKey]="item.active ? 'ref.state.active' : 'ref.state.inactive'"
          [meta]="item.email"
        />

        @if (canManage()) {
          <div class="bd__actions">
            <button
              dba-button
              variant="secondary"
              [disabled]="!!pending.key()"
              (click)="formOpen.set(true)"
            >
              <db-icon name="pencil" [size]="15" />
              {{ 'ref.detail.edit' | translate }}
            </button>
            @if (item.active) {
              <button
                dba-button
                variant="destructive"
                [busy]="pending.key() === 'active'"
                [disabled]="!!pending.key()"
                (click)="deactivate()"
              >
                {{ 'ref.detail.deactivate.label' | translate }}
              </button>
            } @else {
              <button
                dba-button
                [busy]="pending.key() === 'active'"
                [disabled]="!!pending.key()"
                (click)="activate()"
              >
                {{ 'ref.detail.activate' | translate }}
              </button>
            }
          </div>
        }

        <div class="bd__cols">
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'ref.detail.contact' | translate }}</h2>
            <dl class="bd__dl">
              <dt>{{ 'ref.detail.email' | translate }}</dt>
              <dd>{{ item.email }}</dd>
              <dt>{{ 'ref.detail.phone' | translate }}</dt>
              <dd class="dba-mono">{{ item.phone || '—' }}</dd>
              <dt>{{ 'ref.detail.document' | translate }}</dt>
              <dd class="dba-mono">{{ item.document || '—' }}</dd>
              <dt>{{ 'ref.detail.notes' | translate }}</dt>
              <dd>{{ item.notes || '—' }}</dd>
              <dt>{{ 'ref.detail.created' | translate }}</dt>
              <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
            </dl>
          </section>
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'ref.detail.code' | translate }}</h2>
            <dl class="bd__dl">
              <dt>{{ 'ref.detail.codeValue' | translate }}</dt>
              <dd>
                <a class="bd__link dba-mono" [routerLink]="[promotionsPath, item.code.id]">{{
                  item.code.code
                }}</a>
              </dd>
              <dt>{{ 'ref.detail.codeState' | translate }}</dt>
              <dd>
                <dba-org-state
                  [state]="codeFamily[codeState()]"
                  [labelKey]="'promo.state.' + codeState()"
                  variant="inline"
                />
              </dd>
              <dt>{{ 'ref.detail.discount' | translate }}</dt>
              <dd class="dba-mono">{{ item.code.discount }} %</dd>
              <dt>{{ 'ref.detail.usage' | translate }}</dt>
              <dd class="bd__usage">
                <dba-usage-meter [used]="item.code.redeemed" [limit]="item.code.quantity" />
              </dd>
              <dt>{{ 'ref.detail.expires' | translate }}</dt>
              <dd class="dba-mono">{{ day(item.code.expiresAt) }}</dd>
            </dl>
          </section>
        </div>

        <h2 class="dba-panel bd__heading">{{ 'ref.detail.report' | translate }}</h2>
        <dba-promo-report owner="referral" [ownerId]="item.id" />
      </div>

      @if (formOpen()) {
        <dba-referral-form
          [referral]="item"
          [busy]="pending.key() === 'save'"
          (updated)="save($event)"
          (dismissed)="formOpen.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class ReferralDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(PromotionsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('referrals');
  protected readonly promotionsPath = sectionPath('promotions');
  protected readonly codeFamily = CODE_FAMILY;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly referral = signal<Referral | null>(null);
  protected readonly initials = computed(() => initialsOf(this.referral()?.name ?? ''));
  protected readonly codeState = computed(() => {
    const code = this.referral()?.code;
    return code ? codeStateOf(code, new Date()) : 'inactive';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected reload(): void {
    void this.load(this.id());
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected async save(body: UpdateReferralBody): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        this.referral.set(await firstValueFrom(this.api.updateReferral(this.id(), body)));
        this.formOpen.set(false);
        this.notify.success(this.label('ref.form.saveDone'));
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async deactivate(): Promise<void> {
    const referral = this.referral();
    if (!referral) return;
    const confirmed = await this.dialogs.confirm({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'ref.detail.deactivate.title',
      message: 'ref.detail.deactivate.message',
      params: { name: referral.name, code: referral.code.code },
      confirmLabel: 'ref.detail.deactivate.confirm',
    });
    if (confirmed) await this.setActive(false);
  }

  protected activate(): Promise<void> {
    return this.setActive(true);
  }

  private async setActive(active: boolean): Promise<void> {
    await this.pending.run('active', async () => {
      try {
        this.referral.set(await firstValueFrom(this.api.updateReferral(this.id(), { active })));
        this.notify.success(this.label(active ? 'ref.detail.activated' : 'ref.detail.deactivated'));
      } catch (error) {
        this.fail(error);
      }
    });
  }

  private fail(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && PROMO_ERRORS.includes(code);
    this.notify.error(this.label(known ? `promo.error.${code}` : 'promo.error.generic'));
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const referral = await firstValueFrom(this.api.referral(id));
      if (!current()) return;
      this.referral.set(referral);
    } catch (error) {
      if (!current()) return;
      if (errorStatusOf(error) === 404) this.missing.set(true);
      else this.error.set(true);
    }
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
