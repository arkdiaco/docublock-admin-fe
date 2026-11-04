import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import type { PendingLegalEntity } from '../data/legal-entities.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'company', labelKey: 'jur.col.company', width: 'minmax(0, 1.4fr)' },
  { key: 'document', labelKey: 'jur.col.document', width: 'minmax(0, 0.7fr)' },
  { key: 'country', labelKey: 'jur.col.country', width: 'minmax(0, 0.6fr)' },
  { key: 'representative', labelKey: 'jur.col.representative', width: 'minmax(0, 1.2fr)' },
  { key: 'actions', width: '120px', align: 'end' },
];

@Component({
  selector: 'dba-pending-legal-entities-table',
  imports: [TranslatePipe, RouterLink, ButtonComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dba-data-table
      [columns]="columns"
      [label]="'jur.view.pending' | translate"
      [dense]="density.compact()"
      minWidth="820px"
      [total]="total()"
      [from]="from()"
      [to]="to()"
      [page]="page()"
      [pageCount]="pageCount()"
      (pageChange)="pageChange.emit($event)"
    >
      @for (row of items(); track row.signerId) {
        <div class="dba-tr">
          <span class="dba-td cell">
            <a class="bd__link cell__label" [routerLink]="[signersPath, row.signerId]">{{
              row.businessName
            }}</a>
          </span>
          <span class="dba-td cell">
            <span class="cell__muted dba-mono">{{ row.identification }}</span>
          </span>
          <span class="dba-td cell">
            <span class="cell__muted">{{ row.countryName || '—' }}</span>
          </span>
          <span class="dba-td cell">
            @if (row.representative; as person) {
              <span class="cell__label">{{ person.fullName }}</span>
              <span class="cell__meta dba-mono">{{ row.representativeIdentification }}</span>
            } @else if (row.representativeIdentification) {
              <span class="cell__muted">{{ 'jur.pending.noPerson' | translate }}</span>
              <span class="cell__meta dba-mono">{{ row.representativeIdentification }}</span>
            } @else {
              <span class="cell__muted">—</span>
            }
          </span>
          <span class="dba-td dba-td--end">
            @if (canManage()) {
              <button dba-button variant="secondary" (click)="register.emit(row)">
                {{ 'jur.pending.register' | translate }}
              </button>
            }
          </span>
        </div>
      }
    </dba-data-table>
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class PendingLegalEntitiesTableComponent {
  readonly items = input.required<readonly PendingLegalEntity[]>();
  readonly canManage = input(false);
  readonly total = input(0);
  readonly from = input(0);
  readonly to = input(0);
  readonly page = input(1);
  readonly pageCount = input(1);
  readonly register = output<PendingLegalEntity>();
  readonly pageChange = output<number>();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly signersPath = sectionPath('signers');
}
