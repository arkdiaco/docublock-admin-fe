import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { campaignStateOf } from '../data/campaign-state';
import { CommunicationsApi } from '../data/communications.api';
import type { CampaignView } from '../data/communications.models';

const LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'date', labelKey: 'comm.history.col.date', width: '150px' },
  { key: 'text', labelKey: 'comm.history.col.text', width: 'minmax(0, 1.6fr)' },
  { key: 'by', labelKey: 'comm.history.col.by', width: 'minmax(0, 1fr)' },
  { key: 'state', labelKey: 'comm.history.col.state', width: 'minmax(0, 1.1fr)' },
  { key: 'sent', labelKey: 'comm.progress.sent', width: '90px', align: 'end' },
  { key: 'failed', labelKey: 'comm.progress.failed', width: '80px', align: 'end' },
  { key: 'excluded', labelKey: 'comm.progress.excluded', width: '110px', align: 'end' },
];

@Component({
  selector: 'dba-campaign-history',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'comm.history.loading' | translate" />
    } @else if (error()) {
      <div class="bl__panel">
        <dba-empty-state titleKey="comm.history.errorTitle" leadKey="comm.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bl__panel">
        <dba-empty-state titleKey="comm.history.emptyTitle" leadKey="comm.history.emptyLead" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'comm.view.history' | translate"
        [dense]="density.compact()"
        minWidth="900px"
        [total]="total()"
        [from]="(page() - 1) * limit + 1"
        [to]="rangeTo()"
        [page]="page()"
        [pageCount]="pageCount()"
        (pageChange)="goPage($event)"
      >
        @for (row of items(); track row.id) {
          <a class="dba-tr bl-row" [routerLink]="[path, row.id]">
            <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(row.createdAt) }}</span></span>
            <span class="dba-td cell"><span class="cell__label">{{ row.text }}</span></span>
            <span class="dba-td cell"><span class="cell__muted">{{ row.createdByName || '—' }}</span></span>
            <span class="dba-td cell">
              <dba-org-state [state]="stateOf(row).state" [labelKey]="stateOf(row).labelKey" variant="inline" />
            </span>
            <span class="dba-td cell cell--end dba-mono">{{ row.counts.sent }}</span>
            <span class="dba-td cell cell--end dba-mono">{{ row.counts.failed }}</span>
            <span class="dba-td cell cell--end dba-mono">{{ row.counts.excluded }}</span>
          </a>
        }
      </dba-data-table>
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cell--end {
      justify-content: flex-end;
      text-align: end;
    }
  `,
})
export class CampaignHistoryComponent {
  private readonly api = inject(CommunicationsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly limit = LIMIT;
  protected readonly path = sectionPath('communications');
  protected readonly stateOf = campaignStateOf;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<CampaignView[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    void this.reload();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected when(value?: string): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const result = await firstValueFrom(this.api.campaigns({ page: this.page(), limit: LIMIT }));
      if (!current()) return;
      this.items.set(result.items);
      this.total.set(result.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
