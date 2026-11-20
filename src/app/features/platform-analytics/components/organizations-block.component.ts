import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { statTrendOf } from '../data/analytics-format';
import type { PlatformOrganizationActivity } from '../data/platform-activity.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'rank', labelKey: 'pan.org.col.rank', width: '48px', align: 'end' },
  { key: 'organization', labelKey: 'pan.org.col.organization', width: 'minmax(0, 1fr)' },
  { key: 'signatures', labelKey: 'pan.org.col.signatures', width: '110px', align: 'end' },
  { key: 'documents', labelKey: 'pan.org.col.documents', width: '120px', align: 'end' },
  { key: 'people', labelKey: 'pan.org.col.people', width: '110px', align: 'end' },
];

interface TopRow {
  key: string;
  rank: string;
  id: string;
  name: string;
  tributaryNumber: string;
  signatures: string;
  documents: string;
  people: string;
}

@Component({
  selector: 'dba-organizations-block',
  imports: [TranslatePipe, RouterLink, DataTableComponent, EmptyStateComponent, StatBandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-stat-band [cells]="cells()" [label]="'pan.org.statsLabel' | translate" />

    <section class="ob__card">
      <h2 class="dba-panel">{{ 'pan.org.top' | translate }}</h2>
      <span class="dba-meta">{{ 'pan.org.topLead' | translate }}</span>
      @if (rows().length === 0) {
        <dba-empty-state titleKey="pan.org.emptyTitle" leadKey="pan.org.emptyLead" />
      } @else {
        <dba-data-table [columns]="columns" [label]="'pan.org.top' | translate" minWidth="560px">
          @for (row of rows(); track row.key) {
            <div class="dba-tr">
              <span class="dba-td dba-td--end dba-td--mono">{{ row.rank }}</span>
              <span class="dba-td cell">
                @if (organizationsPath()) {
                  <a class="dba-ref cell__label" [routerLink]="[organizationsPath(), row.id]">{{
                    row.name
                  }}</a>
                } @else {
                  <span class="cell__label">{{ row.name }}</span>
                }
                @if (row.tributaryNumber) {
                  <span class="cell__meta">{{ row.tributaryNumber }}</span>
                }
              </span>
              <span class="dba-td dba-td--end dba-td--mono">{{ row.signatures }}</span>
              <span class="dba-td dba-td--end dba-td--mono">{{ row.documents }}</span>
              <span class="dba-td dba-td--end dba-td--mono">{{ row.people }}</span>
            </div>
          }
        </dba-data-table>
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .ob__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .ob__card h2 {
      margin: 0;
    }
  `,
})
export class OrganizationsBlockComponent {
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly data = input.required<PlatformOrganizationActivity>();
  readonly organizationsPath = input<string | null>(null);

  protected readonly columns = COLUMNS;

  protected readonly cells = computed<StatCell[]>(() => {
    const { active, previous } = this.data();
    return [
      {
        key: 'active',
        label: this.text('pan.org.stat.active'),
        value: this.count(active),
        trend: statTrendOf(active, previous.active, this.locale),
        note: this.text('pan.sig.previous', { value: this.count(previous.active) }),
      },
    ];
  });

  protected readonly rows = computed<TopRow[]>(() =>
    this.data().top.map((org, index) => ({
      key: org.organizationId,
      rank: String(index + 1),
      id: org.organizationId,
      name: org.businessName || this.text('pan.org.noName'),
      tributaryNumber: org.tributaryNumber,
      signatures: this.count(org.signatures),
      documents: this.count(org.documents),
      people: this.count(org.people),
    })),
  );

  private count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
