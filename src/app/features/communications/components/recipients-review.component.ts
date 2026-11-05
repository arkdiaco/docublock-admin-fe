import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DensityService } from '../../../core/preferences/density.service';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import type { RecipientsPreview } from '../data/communications.models';

const LIMIT = 20;

const SENDABLE_COLUMNS: readonly DataColumn[] = [
  { key: 'source', labelKey: 'comm.col.source', width: 'minmax(0, 0.6fr)' },
  { key: 'name', labelKey: 'comm.col.name', width: 'minmax(0, 1.2fr)' },
  { key: 'phone', labelKey: 'comm.col.phone', width: 'minmax(0, 1fr)' },
];

const EXCLUDED_COLUMNS: readonly DataColumn[] = [
  ...SENDABLE_COLUMNS,
  { key: 'reason', labelKey: 'comm.col.reason', width: 'minmax(0, 1.2fr)' },
];

type ReviewTab = 'sendable' | 'excluded';

interface ReviewRow {
  key: string;
  source: string;
  name: string;
  phone: string;
  reason: string;
}

@Component({
  selector: 'dba-recipients-review',
  imports: [TranslatePipe, DataTableComponent, EmptyStateComponent, StatBandComponent, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="review">
      <db-stat-band [cells]="cells()" [label]="'comm.review.title' | translate" />
      <db-underline-tabs
        [tabs]="tabs()"
        [active]="tab()"
        [label]="'comm.review.title' | translate"
        (picked)="pick($event)"
      />
      @if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="'comm.review.empty.' + tab()" />
        </div>
      } @else {
        <dba-data-table
          [columns]="tab() === 'sendable' ? sendableColumns : excludedColumns"
          [label]="'comm.review.title' | translate"
          [dense]="density.compact()"
          minWidth="620px"
          [total]="rows().length"
          [from]="(page() - 1) * limit + 1"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="page.set($event)"
        >
          @for (row of pageRows(); track row.key) {
            <div class="dba-tr">
              <span class="dba-td cell"><span class="cell__muted">{{ row.source }}</span></span>
              <span class="dba-td cell"><span class="cell__label">{{ row.name || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.phone || '—' }}</span></span>
              @if (row.reason) {
                <span class="dba-td cell"><span class="cell__muted">{{ row.reason }}</span></span>
              }
            </div>
          }
        </dba-data-table>
      }
    </div>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .review {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
  `,
})
export class RecipientsReviewComponent {
  readonly preview = input.required<RecipientsPreview>();

  private readonly translate = inject(TranslateService);

  protected readonly density = inject(DensityService);
  protected readonly sendableColumns = SENDABLE_COLUMNS;
  protected readonly excludedColumns = EXCLUDED_COLUMNS;
  protected readonly limit = LIMIT;
  protected readonly tab = signal<ReviewTab>('sendable');
  protected readonly page = signal(1);

  protected readonly cells = computed((): StatCell[] => {
    const { sendable, excluded, duplicates } = this.preview();
    return [
      { key: 'sendable', label: this.label('comm.review.sendable'), value: String(sendable.length) },
      {
        key: 'excluded',
        label: this.label('comm.review.excluded'),
        value: String(excluded.length),
        tone: excluded.length > 0 ? 'warn' : 'plain',
      },
      { key: 'duplicates', label: this.label('comm.review.duplicates'), value: String(duplicates) },
    ];
  });

  protected readonly tabs = computed((): UnderlineTab[] => [
    {
      key: 'sendable',
      label: this.label('comm.review.sendable'),
      count: this.preview().sendable.length,
    },
    {
      key: 'excluded',
      label: this.label('comm.review.excluded'),
      count: this.preview().excluded.length,
      ...(this.preview().excluded.length > 0 ? { dot: 'warn' as const } : {}),
    },
  ]);

  protected readonly rows = computed((): ReviewRow[] => {
    const { sendable, excluded } = this.preview();
    if (this.tab() === 'sendable') {
      return sendable.map((row) => ({
        key: row.phone,
        source: this.label(`comm.source.${row.source}`),
        name: row.name,
        phone: row.phone,
        reason: '',
      }));
    }
    return excluded.map((row, index) => ({
      key: `${index}`,
      source: this.label(`comm.source.${row.source}`),
      name: row.name ?? '',
      phone: row.rawPhone ?? '',
      reason: this.label(`comm.reason.${row.reason}`),
    }));
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / LIMIT)));
  protected readonly rangeTo = computed(() => Math.min(this.rows().length, this.page() * LIMIT));
  protected readonly pageRows = computed(() =>
    this.rows().slice((this.page() - 1) * LIMIT, this.page() * LIMIT),
  );

  constructor() {
    effect(() => {
      this.preview();
      untracked(() => this.page.set(1));
    });
  }

  protected pick(key: string): void {
    this.tab.set(key as ReviewTab);
    this.page.set(1);
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
