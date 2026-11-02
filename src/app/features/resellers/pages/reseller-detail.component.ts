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
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { initialsOf } from '../../../shared/domain/initials';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import { HistoryTabComponent } from '../components/history-tab.component';
import { PortfolioTabComponent } from '../components/portfolio-tab.component';
import { RESELLER_ERRORS, ResellersApi } from '../data/resellers.api';
import type { Reseller } from '../data/resellers.models';

type DetailTab = 'portfolio' | 'history';

const NOT_A_RESELLER = 400;

@Component({
  selector: 'dba-reseller-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    UnderlineTabsComponent,
    HistoryTabComponent,
    PortfolioTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'rsl.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="rsl.detail.missingTitle" leadKey="rsl.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'rsl.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="rsl.detail.errorTitle" leadKey="rsl.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (reseller(); as item) {
      <div class="bd">
        <dba-record-header
          [initials]="initials()"
          [title]="item.businessName"
          [state]="item.active ? 'active' : 'suspended'"
          [stateLabelKey]="item.active ? 'rsl.state.active' : 'rsl.state.suspended'"
          [meta]="item.tributaryNumber"
        />

        @if (canOpenOrg() || canManage()) {
          <div class="bd__actions">
            @if (canOpenOrg()) {
              <a dba-button variant="secondary" [routerLink]="[orgsPath, item.id]">{{
                'rsl.detail.openOrg' | translate
              }}</a>
            }
            @if (canManage()) {
              <button
                dba-button
                variant="destructive"
                [busy]="pending.key() === 'remove'"
                [disabled]="!!pending.key() || item.portfolioCount > 0"
                (click)="removeRole()"
              >
                {{ 'rsl.detail.removeRole.label' | translate }}
              </button>
              @if (item.portfolioCount > 0) {
                <span class="dba-meta">{{
                  'rsl.detail.removeRole.blocked' | translate: { count: item.portfolioCount }
                }}</span>
              }
            }
          </div>
        }

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'rsl.detail.section' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'rsl.detail.taxId' | translate }}</dt>
            <dd class="dba-mono">{{ item.tributaryNumber }}</dd>
            <dt>{{ 'rsl.detail.email' | translate }}</dt>
            <dd>{{ item.email || '—' }}</dd>
            <dt>{{ 'rsl.detail.portfolio' | translate }}</dt>
            <dd class="dba-mono">{{ item.portfolioCount }}</dd>
            <dt>{{ 'rsl.detail.created' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
          </dl>
        </section>

        <db-underline-tabs
          [tabs]="tabs()"
          [active]="tab()"
          [label]="'rsl.detail.tabsLabel' | translate"
          (picked)="tab.set($any($event))"
        />
        @if (tab() === 'portfolio') {
          <dba-portfolio-tab [reseller]="item" (changed)="refresh()" />
        } @else {
          <dba-history-tab [resellerId]="item.id" />
        }
      </div>
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class ResellerDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(ResellersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('resellers');
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly tab = signal<DetailTab>('portfolio');
  protected readonly reseller = signal<Reseller | null>(null);
  protected readonly initials = computed(() => initialsOf(this.reseller()?.businessName ?? ''));
  protected readonly tabs = computed<UnderlineTab[]>(() => [
    {
      key: 'portfolio',
      label: this.label('rsl.tab.portfolio'),
      count: this.reseller()?.portfolioCount,
    },
    { key: 'history', label: this.label('rsl.tab.history') },
  ]);

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

  protected async refresh(): Promise<void> {
    try {
      this.reseller.set(await firstValueFrom(this.api.get(this.id())));
    } catch {
      this.notify.error(this.label('rsl.detail.refreshError'));
    }
  }

  protected async removeRole(): Promise<void> {
    const reseller = this.reseller();
    if (!reseller) return;
    const confirmed = await this.dialogs.confirm({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'rsl.detail.removeRole.title',
      message: 'rsl.detail.removeRole.message',
      params: { name: reseller.businessName },
      confirmLabel: 'rsl.detail.removeRole.confirm',
    });
    if (!confirmed) return;
    await this.pending.run('remove', async () => {
      try {
        await firstValueFrom(this.api.setFlag(reseller.id, false));
        this.notify.success(
          this.label('rsl.detail.removeRole.done', { name: reseller.businessName }),
        );
        void this.router.navigate([this.path]);
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && RESELLER_ERRORS.includes(code);
        this.notify.error(this.label(known ? `rsl.error.${code}` : 'rsl.error.generic'));
        await this.refresh();
      }
    });
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const reseller = await firstValueFrom(this.api.get(id));
      if (!current()) return;
      this.reseller.set(reseller);
    } catch (error) {
      if (!current()) return;
      const status = errorStatusOf(error);
      if (status === 404 || status === NOT_A_RESELLER) this.missing.set(true);
      else this.error.set(true);
    }
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
