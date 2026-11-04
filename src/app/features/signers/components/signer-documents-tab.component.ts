import {
  ChangeDetectionStrategy,
  Component,
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
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { statusViewOf, type StatusView } from '../../../shared/domain/document-status-view';
import type { OrgState } from '../../../shared/domain/org-state';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { SignersApi } from '../data/signers.api';
import type { SignerDocument } from '../data/signers.models';

const LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'document', labelKey: 'sig.documents.col.document', width: 'minmax(0, 1.5fr)' },
  { key: 'organization', labelKey: 'sig.documents.col.organization', width: 'minmax(0, 1fr)' },
  { key: 'status', labelKey: 'sig.documents.col.status', width: '130px' },
  { key: 'signer', labelKey: 'sig.documents.col.signer', width: '130px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

export const signerStateOf = (row: SignerDocument): StatusView => {
  const family = (state: OrgState, key: string): StatusView => ({
    family: state,
    labelKey: `sig.documents.state.${key}`,
  });
  if (row.signer?.blocked) return family('suspended', 'blocked');
  if (row.signer?.checked) return family('active', 'signed');
  return family('trial', 'pending');
};

@Component({
  selector: 'dba-signer-documents-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!identityId()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.documents.noIdentityTitle" leadKey="sig.documents.noIdentityLead" />
      </div>
    } @else if (loading()) {
      <db-section-loader [label]="'sig.documents.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.documents.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="sig.documents.emptyTitle" leadKey="sig.documents.emptyLead" />
      </div>
    } @else {
      <p class="dba-meta">{{ 'sig.documents.lead' | translate }}</p>
      <dba-data-table
        [columns]="columns"
        [label]="'sig.documents.label' | translate"
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
          <a class="dba-tr bl-row" [routerLink]="[docsPath, row.id]">
            <span class="dba-td cell">
              <span class="cell__label">{{ row.name }}</span>
              <span class="cell__meta">{{ row.code || '—' }}</span>
            </span>
            <span class="dba-td cell">
              <span class="cell__text">{{ row.organization.businessName || '—' }}</span>
            </span>
            <span class="dba-td">
              <dba-org-state
                [state]="statusOf(row).family"
                [labelKey]="statusOf(row).labelKey"
                variant="inline"
              />
            </span>
            <span class="dba-td cell">
              <dba-org-state
                [state]="signerOf(row).family"
                [labelKey]="signerOf(row).labelKey"
                variant="inline"
              />
              @if (row.signer?.signingAttempts) {
                <span class="cell__meta">{{
                  'sig.documents.attempts' | translate: { count: row.signer?.signingAttempts }
                }}</span>
              }
            </span>
            <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
          </a>
        }
      </dba-data-table>
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class SignerDocumentsTabComponent {
  readonly identityId = input<string>();

  private readonly api = inject(SignersApi);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly docsPath = sectionPath('documents');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<SignerDocument[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    effect(() => {
      this.identityId();
      untracked(() => {
        this.page.set(1);
        void this.reload();
      });
    });
  }

  protected statusOf(row: SignerDocument): StatusView {
    return statusViewOf(row.status);
  }

  protected signerOf(row: SignerDocument): StatusView {
    return signerStateOf(row);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const identity = this.identityId();
    if (!identity) return;
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.documents(identity, this.page(), LIMIT));
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
