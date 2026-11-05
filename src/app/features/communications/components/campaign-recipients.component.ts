import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { failureKey } from '../data/campaign-failures';
import { CommunicationsApi } from '../data/communications.api';
import type { CampaignCounts, CampaignRecipient, CampaignRecipientState } from '../data/communications.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'source', labelKey: 'comm.col.source', width: 'minmax(0, 0.6fr)' },
  { key: 'name', labelKey: 'comm.col.name', width: 'minmax(0, 1.2fr)' },
  { key: 'phone', labelKey: 'comm.col.phone', width: 'minmax(0, 1fr)' },
  { key: 'state', labelKey: 'comm.col.state', width: 'minmax(0, 0.7fr)' },
  { key: 'detail', labelKey: 'comm.col.detail', width: 'minmax(0, 1.4fr)' },
];

type RecipientsFilter = 'all' | 'sent' | 'failed' | 'excluded';

@Component({
  selector: 'dba-campaign-recipients',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    SectionLoaderComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="box">
      <h2 class="dba-panel">{{ 'comm.recipients.result' | translate }}</h2>
      <db-underline-tabs
        [tabs]="tabs()"
        [active]="filter()"
        [label]="'comm.recipients.result' | translate"
        (picked)="pick($event)"
      />
      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'comm.recipients.search' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
      </div>

      @if (loading()) {
        <db-section-loader [label]="'comm.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="comm.errorTitle" leadKey="comm.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="comm.emptyTitle" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'comm.recipients.result' | translate"
          [dense]="density.compact()"
          minWidth="720px"
          [total]="total()"
          [from]="(page() - 1) * limit + 1"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td cell"><span class="cell__muted">{{ 'comm.source.' + row.source | translate }}</span></span>
              <span class="dba-td cell"><span class="cell__label">{{ row.name || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.phone || row.rawPhone || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ 'comm.recipientState.' + row.state | translate }}</span></span>
              <span class="dba-td cell">
                @if (row.messageId) {
                  <span class="cell__meta dba-mono">{{ row.messageId }}</span>
                } @else {
                  <span class="cell__muted">{{ detail(row) }}</span>
                }
              </span>
            </div>
          }
        </dba-data-table>
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .box {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    .box h2 {
      margin: 0;
    }
  `,
})
export class CampaignRecipientsComponent {
  readonly campaignId = input.required<string>();
  readonly counts = input.required<CampaignCounts>();

  private readonly api = inject(CommunicationsApi);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly limit = LIMIT;
  protected readonly filter = signal<RecipientsFilter>('all');
  protected readonly searchDraft = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<CampaignRecipient[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));
  protected readonly tabs = computed((): UnderlineTab[] => {
    const { total, sent, failed, excluded } = this.counts();
    return [
      { key: 'all', label: this.label('comm.recipients.all'), count: total },
      { key: 'sent', label: this.label('comm.progress.sent'), count: sent },
      {
        key: 'failed',
        label: this.label('comm.progress.failed'),
        count: failed,
        ...(failed > 0 ? { dot: 'warn' as const } : {}),
      },
      { key: 'excluded', label: this.label('comm.progress.excluded'), count: excluded },
    ];
  });

  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    let shown = false;
    effect(() => {
      this.campaignId();
      this.counts();
      untracked(() => {
        void this.load(!shown);
        shown = true;
      });
    });
  }

  protected pick(key: string): void {
    this.filter.set(key as RecipientsFilter);
    this.page.set(1);
    void this.load(true);
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.page.set(1);
      void this.load(true);
    }, DEBOUNCE_MS);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load(true);
  }

  protected detail(row: CampaignRecipient): string {
    if (row.state === 'excluded' && row.reason) return this.label(`comm.reason.${row.reason}`);
    if (row.state === 'failed' && row.error) {
      return this.translate.instant(failureKey(row.error), { code: row.error }) as string;
    }
    return '—';
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) {
      this.loading.set(true);
      this.error.set(false);
    }
    const filter = this.filter();
    try {
      const result = await firstValueFrom(
        this.api.campaignRecipients(this.campaignId(), {
          ...(filter === 'all' ? {} : { state: filter as CampaignRecipientState }),
          ...(this.search ? { search: this.search } : {}),
          page: this.page(),
          limit: LIMIT,
        }),
      );
      if (!current()) return;
      this.items.set(result.items);
      this.total.set(result.total);
      if (result.items.length === 0 && result.total > 0) {
        this.page.set(this.pageCount());
        await this.load(false);
      }
    } catch {
      if (current() && withLoader) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
