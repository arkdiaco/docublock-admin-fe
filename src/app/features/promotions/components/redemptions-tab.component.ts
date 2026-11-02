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
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { PromotionsApi } from '../data/promotions.api';
import type { PromoCode, Redemption } from '../data/promotions.models';

const LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'promo.red.col.org', width: 'minmax(0, 1.4fr)' },
  { key: 'reference', labelKey: 'promo.red.col.reference', width: 'minmax(0, 1fr)' },
  { key: 'discount', labelKey: 'promo.red.col.discount', width: '110px', align: 'end' },
  { key: 'date', labelKey: 'promo.red.col.date', width: '140px' },
  { key: 'state', labelKey: 'promo.red.col.state', width: '120px' },
];

@Component({
  selector: 'dba-redemptions-tab',
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
      <db-section-loader [label]="'promo.red.loading' | translate" />
    } @else if (error()) {
      <div class="red__panel">
        <dba-empty-state titleKey="promo.red.errorTitle" leadKey="promo.red.errorLead" />
        <button dba-button variant="secondary" (click)="load()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else {
      @if (missing() > 0) {
        <p class="dba-meta red__note">
          {{ 'promo.red.missing' | translate: { redeemed: code().redeemed, total: total() } }}
        </p>
      }
      @if (items().length === 0) {
        <div class="red__panel">
          <dba-empty-state titleKey="promo.red.emptyTitle" leadKey="promo.red.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'promo.tab.redemptions' | translate"
          [dense]="density.compact()"
          minWidth="720px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td red__clip">
                @if (row.organizationId && row.organizationName && canOpenOrg()) {
                  <a class="red__link" [routerLink]="[orgsPath, row.organizationId]">{{
                    row.organizationName
                  }}</a>
                } @else {
                  {{ row.organizationName || '—' }}
                }
              </span>
              <span class="dba-td dba-td--mono red__clip">{{ row.reference || '—' }}</span>
              <span class="dba-td dba-td--end dba-td--mono">{{ row.discount }} %</span>
              <span class="dba-td dba-td--mono">{{ stamp(row.createdAt) }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.releasedAt ? 'closed' : 'active'"
                  [labelKey]="row.releasedAt ? 'promo.red.released' : 'promo.red.effective'"
                  variant="inline"
                />
              </span>
            </div>
          }
        </dba-data-table>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .red__note {
      margin: 0;
    }

    .red__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .red__clip {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .red__link {
      color: var(--dba-violet-600);
      text-decoration: none;
    }

    .red__link:hover {
      text-decoration: underline;
    }
  `,
})
export class RedemptionsTabComponent {
  readonly code = input.required<PromoCode>();

  private readonly api = inject(PromotionsApi);
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<Redemption[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly missing = computed(() => this.code().redeemed - this.total());
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  private readonly codeId = computed(() => this.code().id);

  constructor() {
    effect(() => {
      this.codeId();
      untracked(() => void this.load());
    });
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.redemptions(this.codeId(), this.page(), LIMIT));
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
