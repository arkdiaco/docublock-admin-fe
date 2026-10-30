import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import {
  RETRYABLE_EVIDENCE,
  type PlatformDocumentDetail,
  type PlatformSigner,
  type RetryableEvidence,
} from '../data/documents.models';
import { canResend, currentTurn, evidenceRowsOf, type EvidenceRow } from '../data/document-view';

export type SignerActionKind = 'unblock' | 'resend' | 'retry';

export interface SignerAction {
  kind: SignerActionKind;
  signer: PlatformSigner;
  type?: RetryableEvidence;
}

const COLUMNS: readonly DataColumn[] = [
  { key: 'order', labelKey: 'docs.signer.col.order', width: '56px' },
  { key: 'name', labelKey: 'docs.signer.col.name', width: 'minmax(0, 1.6fr)' },
  { key: 'signed', labelKey: 'docs.signer.col.signed', width: 'minmax(0, 1fr)' },
  { key: 'attempts', labelKey: 'docs.signer.col.attempts', width: '80px' },
  { key: 'state', labelKey: 'docs.signer.col.state', width: '120px' },
  { key: 'tools', width: '76px', align: 'end' },
];

const STATE_FAMILY = { blocked: 'suspended', turn: 'warning', enabled: 'active' } as const;

interface SignerView {
  signer: PlatformSigner;
  meta: string;
  signedText: string;
  state: keyof typeof STATE_FAMILY;
  evidence: EvidenceRow[];
  actions: ActionMenuItem[];
}

@Component({
  selector: 'dba-document-signers',
  imports: [
    TranslatePipe,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (views().length === 0) {
      <div class="sg__panel">
        <dba-empty-state titleKey="docs.signer.empty" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'docs.d.tab.signers' | translate"
        minWidth="760px"
      >
        @for (view of views(); track view.signer.identityId) {
          <div class="dba-tr sg__row" [class.dba-tr--on]="open() === view.signer.identityId">
            <span class="dba-td dba-td--mono">{{ view.signer.order }}</span>
            <span class="dba-td sg__cell">
              <span class="sg__name">{{ view.signer.name }}</span>
              <span class="sg__meta">{{ view.meta }}</span>
            </span>
            <span class="dba-td sg__text">{{ view.signedText }}</span>
            <span class="dba-td dba-td--mono">{{ view.signer.signingAttempts }}</span>
            <span class="dba-td">
              <dba-org-state
                [state]="family[view.state]"
                [labelKey]="'docs.signer.' + (view.state === 'turn' ? 'inTurn' : view.state)"
                variant="inline"
              />
            </span>
            <span class="dba-td dba-td--end sg__tools">
              @if (view.actions.length) {
                <button
                  dba-button
                  variant="secondary"
                  iconOnly
                  [busy]="busy() === view.signer.identityId"
                  [attr.aria-label]="'docs.signer.menu' | translate"
                  (click)="pickFor(view, menu, $event)"
                >
                  <db-icon name="moreVertical" [size]="15" />
                </button>
              }
              <button
                type="button"
                class="sg__toggle"
                [class.sg__toggle--open]="open() === view.signer.identityId"
                [attr.aria-expanded]="open() === view.signer.identityId"
                [attr.aria-label]="'docs.signer.evidence' | translate"
                (click)="toggle(view.signer.identityId)"
              >
                <db-icon name="chevronDown" [size]="15" />
              </button>
            </span>
          </div>
          @if (open() === view.signer.identityId) {
            <div class="sg__evidence">
              <p class="dba-eyebrow sg__eyebrow">{{ 'docs.signer.evidence' | translate }}</p>
              @if (view.evidence.length === 0) {
                <p class="dba-meta">{{ 'docs.signer.noEvidence' | translate }}</p>
              } @else {
                <dl class="sg__dl">
                  @for (row of view.evidence; track row.key) {
                    <dt>{{ row.labelKey | translate }}</dt>
                    <dd>
                      <dba-org-state
                        [state]="
                          row.state === 'passed'
                            ? 'active'
                            : row.state === 'failed'
                              ? 'suspended'
                              : 'trial'
                        "
                        [labelKey]="
                          isFile(row.key)
                            ? 'docs.evidence.captured'
                            : 'docs.evidence.state.' + row.state
                        "
                        variant="inline"
                      />
                      @if (row.detail) {
                        <code class="dba-ref">{{
                          row.detail === 'unreadable'
                            ? ('docs.evidence.unreadable' | translate)
                            : row.detail
                        }}</code>
                      }
                    </dd>
                  }
                </dl>
              }
            </div>
          }
        }
      </dba-data-table>
      <dba-action-menu
        #menu
        label="docs.signer.menu"
        [heading]="target()?.signer?.name ?? ''"
        [items]="target()?.actions ?? []"
        (picked)="choose($event)"
      />
    }
  `,
  styles: `
    .sg__panel {
      display: flex;
      justify-content: center;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sg__row {
      cursor: default;
    }

    .sg__cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .sg__name,
    .sg__text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sg__name {
      font-weight: 500;
      color: var(--dba-ink);
    }

    .sg__meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .sg__tools {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }

    .sg__toggle {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: var(--dba-radius-key);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .sg__toggle--open db-icon {
      transform: rotate(180deg);
    }

    .sg__toggle:hover {
      background: var(--dba-surface-chip);
    }

    .sg__toggle:focus-visible {
      outline: 2px solid var(--dba-violet-500);
    }

    .sg__evidence {
      padding: 14px 18px 16px 86px;
      border-bottom: 1px solid var(--dba-border-row);
      background: var(--dba-surface-head);
    }

    .sg__eyebrow {
      margin: 0 0 10px;
    }

    .sg__dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 8px 24px;
      margin: 0;
    }

    .sg__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .sg__dl dd {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      font-size: var(--dba-text-cell);
    }

    @media (max-width: 760px) {
      .sg__evidence {
        padding-left: 18px;
      }
    }
  `,
})
export class DocumentSignersComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly document = input.required<PlatformDocumentDetail>();
  readonly canManage = input(false);
  readonly busy = input<string | null>(null);
  readonly action = output<SignerAction>();

  protected readonly columns = COLUMNS;
  protected readonly family = STATE_FAMILY;
  protected readonly open = signal<string | null>(null);
  protected readonly target = signal<SignerView | null>(null);

  protected readonly views = computed<SignerView[]>(() => {
    const doc = this.document();
    const turn = currentTurn(doc.signers);
    return [...doc.signers]
      .sort((a, b) => a.order - b.order)
      .map((signer) => ({
        signer,
        meta:
          [signer.email, signer.identification].filter((part) => !!part).join(' · ') || signer.role,
        signedText: signer.checked
          ? signer.signedAt
            ? `✓ ${formatDate(signer.signedAt, 'd/MM/y HH:mm', this.locale)}`
            : '✓'
          : '—',
        state: signer.blocked
          ? 'blocked'
          : !signer.checked && signer.order === turn
            ? 'turn'
            : 'enabled',
        evidence: evidenceRowsOf(signer.evidence),
        actions: this.canManage() ? this.actionsFor(doc, signer) : [],
      }));
  });

  protected toggle(id: string): void {
    this.open.update((current) => (current === id ? null : id));
  }

  protected isFile(key: string): boolean {
    return !(RETRYABLE_EVIDENCE as readonly string[]).includes(key);
  }

  protected pickFor(view: SignerView, menu: ActionMenuComponent, event: Event): void {
    this.target.set(view);
    menu.toggle(event);
  }

  protected choose(key: string): void {
    const view = this.target();
    if (!view) return;
    if (key === 'unblock' || key === 'resend') {
      this.action.emit({ kind: key, signer: view.signer });
      return;
    }
    const type = key.replace('retry:', '') as RetryableEvidence;
    this.action.emit({ kind: 'retry', signer: view.signer, type });
  }

  private actionsFor(doc: PlatformDocumentDetail, signer: PlatformSigner): ActionMenuItem[] {
    if (doc.status.state === 4 || signer.checked) return [];
    const items: ActionMenuItem[] = [];
    if (canResend(doc, signer, doc.signers))
      items.push({ key: 'resend', labelKey: 'docs.signer.resend' });
    if (signer.blocked) items.push({ key: 'unblock', labelKey: 'docs.signer.unblock' });
    RETRYABLE_EVIDENCE.forEach((type, index) =>
      items.push({
        key: `retry:${type}`,
        labelKey: `docs.signer.retry.${type}`,
        separated: index === 0 && items.length > 0,
      }),
    );
    return items;
  }
}
