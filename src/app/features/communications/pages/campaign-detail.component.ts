import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CampaignProgressComponent } from '../components/campaign-progress.component';
import { CampaignRecipientsComponent } from '../components/campaign-recipients.component';
import { MessagePreviewComponent } from '../components/message-preview.component';
import { RetryConfirmComponent } from '../components/retry-confirm.component';
import { failureKey, uncertainTotal } from '../data/campaign-failures';
import { HISTORY_VIEW, campaignStateOf } from '../data/campaign-state';
import { CommunicationsApi, retryErrorKey } from '../data/communications.api';
import type { CampaignDetail } from '../data/communications.models';

@Component({
  selector: 'dba-campaign-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    CampaignProgressComponent,
    CampaignRecipientsComponent,
    EmptyStateComponent,
    MessagePreviewComponent,
    OrgStateComponent,
    RetryConfirmComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'comm.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="comm.detail.missingTitle" leadKey="comm.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]" [queryParams]="historyQuery">{{
          'comm.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="comm.detail.errorTitle" leadKey="comm.errorLead" />
        <button dba-button variant="secondary" (click)="load(true)">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (campaign(); as item) {
      <div class="bd">
        <header class="head">
          <div class="head__title">
            <h1 class="dba-page">{{ 'comm.detail.title' | translate: { date: when(item.createdAt) } }}</h1>
            <dba-org-state [state]="stateView().state" [labelKey]="stateView().labelKey" />
          </div>
          <div class="bd__actions">
            <a dba-button variant="secondary" [routerLink]="[path]" [queryParams]="historyQuery">{{
              'comm.detail.back' | translate
            }}</a>
            @if (canManage()) {
              <a dba-button variant="secondary" [routerLink]="[path]">{{ 'comm.view.new' | translate }}</a>
              @if (canRetry()) {
                <button dba-button [disabled]="!!pending.key()" (click)="retrying.set(true)">
                  {{ 'comm.retry.action' | translate: { total: item.counts.failed } }}
                </button>
              }
            }
          </div>
        </header>

        <dba-campaign-progress [campaign]="item" (updated)="campaign.set($event)" />

        <div class="bd__cols">
          <dba-message-preview [imageUrl]="item.imageUrl" [text]="item.text" />
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'comm.detail.section' | translate }}</h2>
            <dl class="bd__dl">
              <dt>{{ 'comm.detail.by' | translate }}</dt>
              <dd>{{ item.createdByName || '—' }}</dd>
              <dt>{{ 'comm.detail.reason' | translate }}</dt>
              <dd>{{ item.reason }}</dd>
              <dt>{{ 'comm.detail.finished' | translate }}</dt>
              <dd class="dba-mono">{{ when(item.finishedAt) }}</dd>
              <dt>{{ 'comm.detail.duplicates' | translate }}</dt>
              <dd class="dba-mono">{{ item.duplicates }}</dd>
              <dt>{{ 'comm.detail.retries' | translate }}</dt>
              <dd class="dba-mono">{{ item.retries }}</dd>
            </dl>
            @if (item.failures.length > 0) {
              <h2 class="dba-panel">{{ 'comm.detail.failures' | translate }}</h2>
              <dl class="bd__dl">
                @for (failure of item.failures; track failure.code) {
                  <dt>{{ failureKey(failure.code) | translate: { code: failure.code } }}</dt>
                  <dd class="dba-mono">{{ failure.total }}</dd>
                }
              </dl>
            }
          </section>
        </div>

        <dba-campaign-recipients [campaignId]="item.id" [counts]="item.counts" />
      </div>

      @if (retrying()) {
        <dba-retry-confirm
          [failed]="item.counts.failed"
          [uncertain]="uncertain()"
          [busy]="pending.key() === 'retry'"
          (submitted)="retry($event)"
          (dismissed)="retrying.set(false)"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .head__title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .head__title h1 {
      margin: 0;
    }
  `,
})
export class CampaignDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(CommunicationsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly path = sectionPath('communications');
  protected readonly historyQuery = { vista: HISTORY_VIEW };
  protected readonly failureKey = failureKey;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly retrying = signal(false);
  protected readonly campaign = signal<CampaignDetail | null>(null);
  protected readonly stateView = computed(() => {
    const campaign = this.campaign();
    return campaign ? campaignStateOf(campaign) : { state: 'trial' as const, labelKey: 'comm.state.queued' };
  });
  protected readonly canRetry = computed(() => {
    const campaign = this.campaign();
    return campaign?.state === 'finished' && campaign.counts.failed > 0;
  });
  protected readonly uncertain = computed(() => uncertainTotal(this.campaign()?.failures ?? []));

  constructor() {
    effect(() => {
      if (this.id()) void this.load(true);
    });
  }

  protected when(value?: string): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }

  protected async retry(reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('retry', async () => {
      try {
        const next = await firstValueFrom(this.api.retryCampaign(this.id(), reason));
        this.retrying.set(false);
        this.campaign.update((current) => (current ? { ...current, ...next, failures: [] } : current));
        this.notify.success(this.label('comm.retry.started'));
      } catch (error) {
        this.retrying.set(false);
        this.notify.error(this.label(retryErrorKey(error)));
        await this.load(false);
      }
    });
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const campaign = await firstValueFrom(this.api.campaign(this.id()));
      if (!current()) return;
      this.campaign.set(campaign);
    } catch (error) {
      if (!current()) return;
      const status = errorStatusOf(error);
      if (withLoader && (status === 404 || status === 400)) this.missing.set(true);
      else if (withLoader) this.error.set(true);
    }
    if (current()) this.loading.set(false);
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
