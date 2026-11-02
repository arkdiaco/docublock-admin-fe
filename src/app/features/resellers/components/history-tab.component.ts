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
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { ResellersApi } from '../data/resellers.api';
import type { HistoryEntry } from '../data/resellers.models';

const LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'what', labelKey: 'rsl.hist.col.what', width: 'minmax(0, 2fr)' },
  { key: 'who', labelKey: 'rsl.hist.col.who', width: 'minmax(0, 1fr)' },
  { key: 'when', labelKey: 'rsl.hist.col.when', width: '140px' },
];

const sentenceKeyOf = (entry: HistoryEntry): string =>
  entry.action === 'organization.reseller_assigned' && entry.previousResellerId
    ? 'rsl.hist.action.moved'
    : `rsl.hist.action.${entry.action}`;

@Component({
  selector: 'dba-history-tab',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'rsl.hist.loading' | translate" />
    } @else if (error()) {
      <div class="hist__panel">
        <dba-empty-state titleKey="rsl.hist.errorTitle" leadKey="rsl.hist.errorLead" />
        <button dba-button variant="secondary" (click)="load()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="hist__panel">
        <dba-empty-state titleKey="rsl.hist.emptyTitle" leadKey="rsl.hist.emptyLead" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'rsl.tab.history' | translate"
        [dense]="density.compact()"
        minWidth="640px"
        [total]="total()"
        [from]="rangeFrom()"
        [to]="rangeTo()"
        [page]="page()"
        [pageCount]="pageCount()"
        (pageChange)="goPage($event)"
      >
        @for (row of rows(); track row.id) {
          <div class="dba-tr">
            <span class="dba-td hist__text">{{ row.sentence }}</span>
            <span class="dba-td hist__text">{{ row.who }}</span>
            <span class="dba-td dba-td--mono">{{ row.when }}</span>
          </div>
        }
      </dba-data-table>
    }
  `,
  styles: `
    .hist__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .hist__text {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class HistoryTabComponent {
  readonly resellerId = input.required<string>();

  private readonly api = inject(ResellersApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<HistoryEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly rows = computed(() =>
    this.items().map((entry) => {
      const unknown = this.translate.instant('rsl.hist.unknownOrg') as string;
      return {
        id: entry.id,
        sentence: this.translate.instant(sentenceKeyOf(entry), {
          org: entry.organizationName ?? unknown,
          reseller: entry.resellerName ?? unknown,
          previous: entry.previousResellerName ?? unknown,
        }) as string,
        who: entry.actorName ?? (this.translate.instant('rsl.hist.unknownActor') as string),
        when: entry.createdAt ? formatDate(entry.createdAt, 'd/MM/y HH:mm', this.locale) : '—',
      };
    }),
  );
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    effect(() => {
      this.resellerId();
      untracked(() => void this.load());
    });
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.history(this.resellerId(), this.page(), LIMIT));
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
