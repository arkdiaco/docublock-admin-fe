import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { moneyExact } from '../../../shared/domain/money';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { PromotionsApi, type ReportOwner } from '../data/promotions.api';
import { dayOf, endOfDayIso, firstOfMonth, startOfDayIso } from '../data/promotions-view';
import type { CurrencyTotals, PromoReport } from '../data/promotions.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'kind', labelKey: 'promoReport.col.kind', width: '120px' },
  { key: 'reference', labelKey: 'promoReport.col.reference', width: 'minmax(0, 1fr)' },
  { key: 'org', labelKey: 'promoReport.col.org', width: 'minmax(0, 1.3fr)' },
  { key: 'date', labelKey: 'promoReport.col.date', width: '100px' },
  { key: 'discount', labelKey: 'promoReport.col.discount', width: '130px', align: 'end' },
  { key: 'paid', labelKey: 'promoReport.col.paid', width: '140px', align: 'end' },
];

@Component({
  selector: 'dba-promo-report',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rep">
      <div class="rep__tools">
        <dba-field
          label="promoReport.from"
          type="date"
          [value]="from()"
          (valueChange)="setFrom($event)"
        />
        <dba-field
          label="promoReport.to"
          type="date"
          [error]="rangeProblem() ? 'promoReport.rangeInvalid' : ''"
          [value]="to()"
          (valueChange)="setTo($event)"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'promoReport.loading' | translate" />
      } @else if (error()) {
        <div class="rep__panel">
          <dba-empty-state titleKey="promoReport.errorTitle" leadKey="promoReport.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (report(); as data) {
        <section class="rep__group">
          <h3 class="dba-panel">{{ 'promoReport.redemptionsTitle' | translate }}</h3>
          <db-stat-band
            [cells]="redemptionCells()"
            [label]="'promoReport.redemptionsTitle' | translate"
          />
          <p class="dba-meta rep__note">{{ 'promoReport.redemptionsNote' | translate }}</p>
        </section>

        @for (total of data.totals; track total.currency) {
          <section class="rep__group">
            <h3 class="dba-panel">
              {{ 'promoReport.totalsTitle' | translate: { currency: total.currency } }}
            </h3>
            <db-stat-band [cells]="cellsOf(total)" [label]="total.currency" />
          </section>
        }

        @if (data.items.length === 0) {
          <div class="rep__panel">
            <dba-empty-state titleKey="promoReport.emptyTitle" leadKey="promoReport.emptyLead" />
          </div>
        } @else {
          <dba-data-table
            [columns]="columns"
            [label]="'promoReport.tableLabel' | translate"
            [dense]="density.compact()"
            minWidth="780px"
          >
            @for (item of data.items; track item.kind + item.reference) {
              <div class="dba-tr">
                <span class="dba-td">{{ 'promoReport.kind.' + item.kind | translate }}</span>
                <span class="dba-td dba-td--mono rep__clip">{{ item.reference }}</span>
                <span class="dba-td rep__clip">
                  @if (canOpenOrg()) {
                    <a class="rep__link" [routerLink]="[orgsPath, item.organizationId]">{{
                      item.organizationName
                    }}</a>
                  } @else {
                    {{ item.organizationName }}
                  }
                </span>
                <span class="dba-td dba-td--mono">{{ day(item.date) }}</span>
                <span class="dba-td dba-td--end dba-td--mono">{{
                  money(item.promoDiscount, item.currency)
                }}</span>
                <span class="dba-td dba-td--end dba-td--mono">{{
                  money(item.paid, item.currency)
                }}</span>
              </div>
            }
          </dba-data-table>
        }
      }
    </div>
  `,
  styles: `
    .rep,
    .rep__group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rep {
      gap: 18px;
    }

    .rep__group h3 {
      margin: 0;
    }

    .rep__note {
      margin: 0;
    }

    .rep__tools {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
    }

    .rep__tools dba-field {
      flex: 0 1 180px;
      min-width: 140px;
    }

    .rep__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .rep__clip {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rep__link {
      color: var(--dba-violet-600);
      text-decoration: none;
    }

    .rep__link:hover {
      text-decoration: underline;
    }
  `,
})
export class PromoReportComponent {
  readonly owner = input.required<ReportOwner>();
  readonly ownerId = input.required<string>();
  readonly loaded = output<PromoReport>();

  private readonly api = inject(PromotionsApi);
  private readonly auth = inject(AuthStore);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));

  protected readonly from = signal(firstOfMonth(new Date()));
  protected readonly to = signal(dayOf(new Date()));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly report = signal<PromoReport | null>(null);
  protected readonly rangeProblem = computed(
    () => !!this.from() && !!this.to() && this.from() > this.to(),
  );
  protected readonly redemptionCells = computed<StatCell[]>(() => {
    const stats = this.report()?.redemptions;
    if (!stats) return [];
    return [
      {
        key: 'effective',
        label: this.label('promoReport.effective'),
        value: String(stats.effective),
      },
      { key: 'released', label: this.label('promoReport.released'), value: String(stats.released) },
      { key: 'total', label: this.label('promoReport.recorded'), value: String(stats.total) },
    ];
  });

  constructor() {
    effect(() => {
      this.owner();
      this.ownerId();
      untracked(() => void this.load());
    });
  }

  protected setFrom(value: string): void {
    this.from.set(value);
    void this.load();
  }

  protected setTo(value: string): void {
    this.to.set(value);
    void this.load();
  }

  protected cellsOf(total: CurrencyTotals): StatCell[] {
    const money = (amount: number): string => this.money(amount, total.currency);
    const discount = total.marketplace.promoDiscount + total.plans.discount;
    return [
      { key: 'total', label: this.label('promoReport.total'), value: money(total.total) },
      {
        key: 'marketplace',
        label: this.label('promoReport.marketplace'),
        value: money(total.marketplace.total),
        note: this.label('promoReport.orders', { count: total.marketplace.orders }),
      },
      {
        key: 'plans',
        label: this.label('promoReport.plans'),
        value: money(total.plans.amount),
        note: this.label('promoReport.transactions', { count: total.plans.transactions }),
      },
      { key: 'discount', label: this.label('promoReport.discount'), value: money(discount) },
    ];
  }

  protected money(amount: number, currency: string): string {
    return moneyExact(amount, currency, this.locale);
  }

  protected day(value: string): string {
    return formatDate(value, 'd/MM/y', this.locale);
  }

  protected async load(): Promise<void> {
    if (!this.from() || !this.to() || this.rangeProblem()) return;
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const report = await firstValueFrom(
        this.api.report(this.owner(), this.ownerId(), {
          from: startOfDayIso(this.from()),
          to: endOfDayIso(this.to()),
        }),
      );
      if (!current()) return;
      this.report.set(report);
      this.loaded.emit(report);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
