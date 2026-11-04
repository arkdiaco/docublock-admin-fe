import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
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
import { SignersApi } from '../data/signers.api';
import type { SignerLegalEntity } from '../data/signers.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'company', labelKey: 'sig.legalEntities.col.company', width: 'minmax(0, 1.5fr)' },
  { key: 'document', labelKey: 'sig.legalEntities.col.document', width: 'minmax(0, 0.8fr)' },
  { key: 'role', labelKey: 'sig.legalEntities.col.role', width: '170px' },
  { key: 'state', labelKey: 'sig.legalEntities.col.state', width: '110px' },
];

@Component({
  selector: 'dba-signer-legal-entities-tab',
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
      <db-section-loader [label]="'sig.legalEntities.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state
          titleKey="sig.legalEntities.errorTitle"
          leadKey="sig.legalEntities.errorLead"
        />
        <button dba-button variant="secondary" (click)="load()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state
          titleKey="sig.legalEntities.emptyTitle"
          leadKey="sig.legalEntities.emptyLead"
        />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'sig.tab.legalEntities' | translate"
        [dense]="density.compact()"
        minWidth="620px"
      >
        @for (row of items(); track row.id) {
          <div class="dba-tr">
            <span class="dba-td cell">
              <a class="bd__link cell__label" [routerLink]="[path, row.id]">{{
                row.businessName
              }}</a>
            </span>
            <span class="dba-td cell">
              <span class="cell__muted dba-mono">{{ row.identification }}</span>
            </span>
            <span class="dba-td cell">
              <span class="cell__muted">{{
                (row.isLegalRep ? 'sig.legalEntities.legalRep' : 'sig.legalEntities.proxy')
                  | translate
              }}</span>
            </span>
            <span class="dba-td">
              <dba-org-state
                [state]="row.active ? 'active' : 'closed'"
                [labelKey]="row.active ? 'sig.legalEntities.active' : 'sig.legalEntities.inactive'"
                variant="inline"
              />
            </span>
          </div>
        }
      </dba-data-table>
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class SignerLegalEntitiesTabComponent {
  readonly signerId = input.required<string>();

  private readonly api = inject(SignersApi);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('legalEntities');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<SignerLegalEntity[]>([]);

  constructor() {
    effect(() => {
      this.signerId();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const items = await firstValueFrom(this.api.legalEntities(this.signerId()));
      if (current()) this.items.set(items);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
