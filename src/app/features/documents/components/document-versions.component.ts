import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import type { DocumentVersion } from '../data/documents.models';
import { currentVersionId, shortHash } from '../data/document-view';

const COLUMNS: readonly DataColumn[] = [
  { key: 'index', labelKey: 'docs.version.col.index', width: '120px' },
  { key: 'created', labelKey: 'docs.version.col.created', width: 'minmax(0, 1fr)' },
  { key: 'state', labelKey: 'docs.version.col.state', width: 'minmax(0, 1fr)' },
  { key: 'expires', labelKey: 'docs.version.col.expires', width: 'minmax(0, 1fr)' },
  { key: 'checksum', labelKey: 'docs.version.col.checksum', width: '180px' },
  { key: 'tools', width: '190px', align: 'end' },
];

const STATES = ['0', '1', '2', '3'];

interface VersionView extends DocumentVersion {
  current: boolean;
  createdText: string;
  expiresText: string;
  stateKey: string | null;
  hash: string;
}

@Component({
  selector: 'dba-document-versions',
  imports: [TranslatePipe, ButtonComponent, DataTableComponent, EmptyStateComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (views().length === 0) {
      <div class="vs__panel">
        <dba-empty-state titleKey="docs.version.empty" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'docs.d.tab.versions' | translate"
        minWidth="820px"
      >
        @for (view of views(); track view.id) {
          <div class="dba-tr vs__row">
            <span class="dba-td vs__index">
              <code class="dba-mono">v{{ view.index }}</code>
              @if (view.current) {
                <span class="dba-tag">{{ 'docs.version.current' | translate }}</span>
              }
            </span>
            <span class="dba-td dba-td--mono">{{ view.createdText }}</span>
            <span class="dba-td">{{ view.stateKey ? (view.stateKey | translate) : '—' }}</span>
            <span class="dba-td dba-td--mono">{{ view.expiresText }}</span>
            <span class="dba-td dba-td--mono" [attr.title]="view.checksum || null">{{
              view.hash
            }}</span>
            <span class="dba-td dba-td--end vs__tools">
              <button
                dba-button
                variant="secondary"
                [busy]="busy() === 'view:' + view.id"
                (click)="viewed.emit(view)"
              >
                <db-icon name="eye" [size]="15" />
                {{ 'docs.version.view' | translate }}
              </button>
              @if (canDetach()) {
                <button
                  dba-button
                  variant="secondary"
                  iconOnly
                  [busy]="busy() === 'detach:' + view.id"
                  [attr.aria-label]="'docs.version.detach' | translate"
                  [attr.title]="'docs.version.detach' | translate"
                  (click)="detached.emit(view)"
                >
                  <db-icon name="chain" [size]="15" />
                </button>
              }
            </span>
          </div>
        }
      </dba-data-table>
    }
  `,
  styles: `
    .vs__panel {
      display: flex;
      justify-content: center;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .vs__row {
      cursor: default;
    }

    .vs__index {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .vs__tools {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
  `,
})
export class DocumentVersionsComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly versions = input.required<readonly DocumentVersion[]>();
  readonly canManage = input(false);
  readonly cancelled = input(false);
  readonly busy = input<string | null>(null);
  readonly viewed = output<DocumentVersion>();
  readonly detached = output<DocumentVersion>();

  protected readonly columns = COLUMNS;
  protected readonly canDetach = computed(
    () => this.canManage() && !this.cancelled() && this.versions().length > 1,
  );

  protected readonly views = computed<VersionView[]>(() => {
    const current = currentVersionId(this.versions());
    return [...this.versions()]
      .sort((a, b) => b.index - a.index)
      .map((version) => ({
        ...version,
        current: version.id === current,
        createdText: this.stamp(version.createdAt),
        expiresText: this.stamp(version.expirationSign),
        stateKey:
          version.signatureProgress && STATES.includes(version.signatureProgress)
            ? `docs.version.progress.${version.signatureProgress}`
            : null,
        hash: shortHash(version.checksum),
      }));
  });

  private stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }
}
