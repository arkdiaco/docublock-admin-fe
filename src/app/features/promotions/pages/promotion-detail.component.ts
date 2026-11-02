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
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { PromoFormComponent } from '../components/promo-form.component';
import { PromoReportComponent } from '../components/promo-report.component';
import { RedemptionsTabComponent } from '../components/redemptions-tab.component';
import { PromotionsApi } from '../data/promotions.api';
import { CODE_FAMILY, PROMO_ERRORS, codeStateOf } from '../data/promotions-view';
import type {
  CountryOption,
  PromoCode,
  PromoReport,
  UpdatePromoBody,
} from '../data/promotions.models';

type DetailTab = 'report' | 'redemptions';

@Component({
  selector: 'dba-promotion-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    UnderlineTabsComponent,
    UsageMeterComponent,
    PromoFormComponent,
    PromoReportComponent,
    RedemptionsTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'promo.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="promo.detail.missingTitle" leadKey="promo.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'promo.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="promo.detail.errorTitle" leadKey="promo.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (code(); as item) {
      <div class="bd">
        <dba-record-header
          initials="PR"
          [title]="item.code"
          [state]="family[state()]"
          [stateLabelKey]="'promo.state.' + state()"
          [meta]="item.name"
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
              {{ 'promo.detail.edit' | translate }}
            </button>
            @if (item.active) {
              <button
                dba-button
                variant="destructive"
                [busy]="pending.key() === 'active'"
                [disabled]="!!pending.key()"
                (click)="deactivate()"
              >
                {{ 'promo.detail.deactivate.label' | translate }}
              </button>
            } @else {
              <button
                dba-button
                [busy]="pending.key() === 'active'"
                [disabled]="!!pending.key()"
                (click)="activate()"
              >
                {{ 'promo.detail.activate' | translate }}
              </button>
            }
          </div>
        }

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'promo.detail.section' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'promo.detail.discount' | translate }}</dt>
            <dd class="dba-mono">{{ item.discount }} %</dd>
            <dt>{{ 'promo.detail.usage' | translate }}</dt>
            <dd class="bd__usage">
              <dba-usage-meter [used]="item.redeemed" [limit]="item.quantity" />
            </dd>
            <dt>{{ 'promo.detail.remaining' | translate }}</dt>
            <dd class="dba-mono">{{ item.remaining }}</dd>
            <dt>{{ 'promo.detail.country' | translate }}</dt>
            <dd>{{ countryName() }}</dd>
            <dt>{{ 'promo.detail.expires' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.expiresAt) }}</dd>
            <dt>{{ 'promo.detail.created' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
            @if (owner(); as person) {
              <dt>{{ 'promo.detail.owner' | translate }}</dt>
              <dd>
                <a class="bd__link" [routerLink]="[referralsPath, person.id]">{{ person.name }}</a>
              </dd>
            }
          </dl>
        </section>

        <db-underline-tabs
          [tabs]="tabs()"
          [active]="tab()"
          [label]="'promo.detail.tabsLabel' | translate"
          (picked)="tab.set($any($event))"
        />
        @if (tab() === 'report') {
          <dba-promo-report owner="code" [ownerId]="item.id" (loaded)="onReport($event)" />
        } @else {
          <dba-redemptions-tab [code]="item" />
        }
      </div>

      @if (formOpen()) {
        <dba-promo-form
          [code]="item"
          [countries]="countries()"
          [busy]="pending.key() === 'save'"
          (updated)="save($event)"
          (dismissed)="formOpen.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class PromotionDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(PromotionsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('promotions');
  protected readonly referralsPath = sectionPath('referrals');
  protected readonly family = CODE_FAMILY;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly tab = signal<DetailTab>('report');
  protected readonly code = signal<PromoCode | null>(null);
  protected readonly owner = signal<PromoReport['referrer']>(null);
  protected readonly countries = signal<CountryOption[]>([]);

  protected readonly state = computed(() => {
    const code = this.code();
    return code ? codeStateOf(code, new Date()) : 'inactive';
  });
  protected readonly countryName = computed(() => {
    const id = this.code()?.countryId;
    if (!id) return this.label('promo.anyCountry');
    return this.countries().find((c) => c.id === id)?.name ?? '—';
  });
  protected readonly tabs = computed<UnderlineTab[]>(() => [
    { key: 'report', label: this.label('promo.tab.report') },
    { key: 'redemptions', label: this.label('promo.tab.redemptions') },
  ]);

  constructor() {
    void this.loadCountries();
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected reload(): void {
    void this.load(this.id());
  }

  protected onReport(report: PromoReport): void {
    this.owner.set(report.referrer);
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected async save(body: UpdatePromoBody): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        this.code.set(await firstValueFrom(this.api.updateCode(this.id(), body)));
        this.formOpen.set(false);
        this.notify.success(this.label('promo.form.saveDone'));
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async deactivate(): Promise<void> {
    const code = this.code();
    if (!code) return;
    const confirmed = await this.dialogs.confirm({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'promo.detail.deactivate.title',
      message: 'promo.detail.deactivate.message',
      params: { code: code.code },
      confirmLabel: 'promo.detail.deactivate.confirm',
    });
    if (confirmed) await this.setActive(false);
  }

  protected activate(): Promise<void> {
    return this.setActive(true);
  }

  private async setActive(active: boolean): Promise<void> {
    await this.pending.run('active', async () => {
      try {
        this.code.set(await firstValueFrom(this.api.updateCode(this.id(), { active })));
        this.notify.success(
          this.label(active ? 'promo.detail.activated' : 'promo.detail.deactivated'),
        );
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
      const code = await firstValueFrom(this.api.code(id));
      if (!current()) return;
      this.code.set(code);
    } catch (error) {
      if (!current()) return;
      if (errorStatusOf(error) === 404) this.missing.set(true);
      else this.error.set(true);
    }
    this.loading.set(false);
  }

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await firstValueFrom(this.api.countries()));
    } catch {
      this.countries.set([]);
    }
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
