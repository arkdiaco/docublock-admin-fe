import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  LOCALE_ID,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import type { PlatformDocumentDetail, PlatformSigner } from '../data/documents.models';
import { canResend } from '../data/document-view';
import {
  SIGNER_STATE_FAMILY,
  SIGNER_STATE_LABEL,
  signerStateOf,
  type SignerPanelRequest,
  type SignerState,
} from '../data/signer-view';
import { SignerPanelComponent } from './signer-panel.component';

export type SignerActionKind =
  'unblock' | 'resend' | 'reactivate' | 'features' | 'revokeLinks' | 'remove';

const ACTION_KINDS: readonly SignerActionKind[] = [
  'unblock',
  'resend',
  'reactivate',
  'features',
  'revokeLinks',
  'remove',
];

export interface SignerAction {
  kind: SignerActionKind;
  signer: PlatformSigner;
}

export interface SignerPanelEvent {
  signer: PlatformSigner;
  request: SignerPanelRequest;
}

const COLUMNS: readonly DataColumn[] = [
  { key: 'order', labelKey: 'docs.signer.col.order', width: '56px' },
  { key: 'name', labelKey: 'docs.signer.col.name', width: 'minmax(0, 1.6fr)' },
  { key: 'signed', labelKey: 'docs.signer.col.signed', width: 'minmax(0, 1fr)' },
  { key: 'attempts', labelKey: 'docs.signer.col.attempts', width: '80px' },
  { key: 'state', labelKey: 'docs.signer.col.state', width: '120px' },
  { key: 'tools', width: '76px', align: 'end' },
];

interface SignerView {
  signer: PlatformSigner;
  meta: string;
  signedText: string;
  state: SignerState;
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
    SignerPanelComponent,
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
                [labelKey]="stateLabel[view.state]"
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
                [attr.aria-label]="'docs.signer.panel' | translate"
                (click)="toggle(view.signer.identityId)"
              >
                <db-icon name="chevronDown" [size]="15" />
              </button>
            </span>
          </div>
        }
      </dba-data-table>
      <dba-action-menu
        #menu
        label="docs.signer.menu"
        [heading]="target()?.signer?.name ?? ''"
        [items]="target()?.actions ?? []"
        (picked)="choose($event)"
      />
      @if (openView(); as view) {
        <div #openPanel class="sg__open">
          <dba-signer-panel
            [signer]="view.signer"
            [canOpenSigner]="canOpenSigner()"
            [busy]="pendingKey()"
            (request)="panelRequest.emit({ signer: view.signer, request: $event })"
            (closed)="open.set(null)"
          />
        </div>
      }
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

    .sg__open {
      margin-top: 18px;
      scroll-margin-top: 18px;
    }
  `,
})
export class DocumentSignersComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly injector = inject(Injector);
  private readonly openPanel = viewChild<ElementRef<HTMLElement>>('openPanel');

  readonly document = input.required<PlatformDocumentDetail>();
  readonly canManage = input(false);
  readonly canOpenSigner = input(false);
  readonly busy = input<string | null>(null);
  readonly pendingKey = input<string | null>(null);
  readonly action = output<SignerAction>();
  readonly panelRequest = output<SignerPanelEvent>();

  protected readonly columns = COLUMNS;
  protected readonly family = SIGNER_STATE_FAMILY;
  protected readonly stateLabel = SIGNER_STATE_LABEL;
  protected readonly open = signal<string | null>(null);
  protected readonly target = signal<SignerView | null>(null);

  protected readonly views = computed<SignerView[]>(() => {
    const doc = this.document();
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
        state: signerStateOf(doc, signer),
        actions: this.canManage() ? this.actionsFor(doc, signer) : [],
      }));
  });

  protected readonly openView = computed(
    () => this.views().find((view) => view.signer.identityId === this.open()) ?? null,
  );

  protected toggle(id: string): void {
    this.open.update((current) => (current === id ? null : id));
    if (this.open() !== id) return;
    afterNextRender(
      () =>
        this.openPanel()?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }),
      { injector: this.injector },
    );
  }

  protected pickFor(view: SignerView, menu: ActionMenuComponent, event: Event): void {
    this.target.set(view);
    menu.toggle(event);
  }

  protected choose(key: string): void {
    const view = this.target();
    const kind = ACTION_KINDS.find((option) => option === key);
    if (view && kind) this.action.emit({ kind, signer: view.signer });
  }

  private actionsFor(doc: PlatformDocumentDetail, signer: PlatformSigner): ActionMenuItem[] {
    const items = this.editsFor(doc, signer);
    items.push({
      key: 'revokeLinks',
      labelKey: 'docs.signer.revokeLinks',
      separated: items.length > 0,
    });
    if (signer.removal || signer.removalBlock)
      items.push({
        key: 'remove',
        labelKey: 'docs.signer.remove',
        danger: true,
        separated: true,
        ...(signer.removal ? {} : { disabled: true, hintKey: `docs.error.${signer.removalBlock}` }),
      });
    return items;
  }

  private editsFor(doc: PlatformDocumentDetail, signer: PlatformSigner): ActionMenuItem[] {
    if (doc.status.state === 4 || signer.checked) return [];
    const items: ActionMenuItem[] = [];
    if (canResend(doc, signer)) items.push({ key: 'resend', labelKey: 'docs.signer.resend' });
    if (signer.blocked) items.push({ key: 'unblock', labelKey: 'docs.signer.unblock' });
    if (signer.editBlock) return items;
    const separated = items.length > 0;
    if (signer.reactivationScopes.length > 0)
      items.push({ key: 'reactivate', labelKey: 'docs.signer.reactivate', separated });
    items.push({
      key: 'features',
      labelKey: 'docs.signer.features',
      separated: separated && signer.reactivationScopes.length === 0,
    });
    return items;
  }
}
