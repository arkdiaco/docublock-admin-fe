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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import type { DocumentVersion, PlatformSigner } from '../data/documents.models';
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

interface CommentView {
  id: string;
  author: string;
  text: string;
  meta: string;
  at: number;
}

@Component({
  selector: 'dba-document-versions',
  imports: [
    TranslatePipe,
    AuditEventComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
  ],
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
      @if (comments().length > 0) {
        <section class="vs__comments">
          <p class="dba-eyebrow vs__eyebrow">
            {{ 'docs.version.comments' | translate: { total: comments().length } }}
          </p>
          @for (comment of comments(); track comment.id; let last = $last) {
            <dba-audit-event [actor]="comment.author" [meta]="comment.meta" [last]="last">
              <span class="vs__comment">{{ comment.text }}</span>
            </dba-audit-event>
          }
        </section>
      }
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

    .vs__comments {
      margin-top: 16px;
      padding: 16px 18px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .vs__eyebrow {
      margin: 0 0 14px;
    }

    .vs__comment {
      display: block;
      margin-top: 2px;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
  `,
})
export class DocumentVersionsComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly versions = input.required<readonly DocumentVersion[]>();
  readonly signers = input<readonly PlatformSigner[]>([]);
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

  protected readonly comments = computed<CommentView[]>(() => {
    const names = new Map(this.signers().map((signer) => [signer.identityId, signer.name]));
    const signerLabel = this.translate.instant('docs.version.bySigner') as string;
    const userLabel = this.translate.instant('docs.version.byUser') as string;
    return this.versions()
      .flatMap((version) =>
        (version.comments ?? [])
          .filter((comment) => comment.comment.trim() !== '')
          .map((comment, index) => {
            const name = comment.userId ? '' : (names.get(comment.signerId) ?? '');
            return {
              id: `${version.id}:${index}`,
              author: comment.userId ? userLabel : name || signerLabel,
              text: comment.comment.trim(),
              meta: [
                `v${version.index}`,
                comment.date ? formatDate(comment.date, 'd/MM/y HH:mm', this.locale) : undefined,
                name ? signerLabel : undefined,
              ]
                .filter((part) => !!part)
                .join(' · '),
              at: comment.date ? Date.parse(comment.date) : 0,
            };
          }),
      )
      .sort((a, b) => b.at - a.at);
  });

  private stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }
}
