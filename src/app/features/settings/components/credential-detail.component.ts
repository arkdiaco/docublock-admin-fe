import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { kindKeyOf, pieceStateOf } from '../data/credentials-view';
import type { CredentialGroup, CredentialItem } from '../data/settings.models';

@Component({
  selector: 'dba-credential-detail',
  imports: [TranslatePipe, ModalShellComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="lock"
      [title]="'cfg.cred.group.' + group().key + '.label' | translate"
      [subtitle]="'cfg.cred.group.' + group().key + '.use' | translate"
      [maxWidth]="560"
      confirmLabel="common.close"
      [cancelable]="false"
      (confirmed)="dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <p class="item__lead">{{ 'cfg.cred.detail.lead' | translate }}</p>
      <ul class="cred">
        @for (item of group().items; track item.variable) {
          <li class="cred__row">
            <span class="cred__name">
              <span class="cred__label">{{ labelOf(item) }}</span>
              <span class="cred__var dba-mono">{{ item.variable }}</span>
            </span>
            <span class="cred__side">
              @if (!item.required) {
                <span class="cred__optional">{{ 'cfg.cred.optional' | translate }}</span>
              }
              <dba-org-state
                [state]="pieceOf(item).state"
                [labelKey]="pieceOf(item).labelKey"
                variant="inline"
              />
            </span>
          </li>
        }
      </ul>
      @if (group().state !== 'configured') {
        <p class="cred__hint">{{ 'cfg.cred.detail.' + group().state | translate }}</p>
      }
    </db-modal-shell>
  `,
  styleUrl: './setting-item.scss',
  styles: `
    .cred {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .cred__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 16px;
      padding: 10px 0;
      border-top: 1px solid var(--dba-border-row);
    }

    .cred__row:first-child {
      border-top: 0;
    }

    .cred__name {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .cred__label {
      font-size: var(--dba-text-label);
      color: var(--dba-ink);
    }

    .cred__var {
      font-size: var(--dba-text-micro);
      color: var(--dba-text-muted);
      overflow-wrap: anywhere;
    }

    .cred__side {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .cred__optional {
      font-size: var(--dba-text-small);
      color: var(--dba-text-muted);
    }

    .cred__hint {
      margin: 14px 0 0;
      font-size: var(--dba-text-label);
      line-height: 1.45;
      color: var(--dba-text-muted);
    }
  `,
})
export class CredentialDetailComponent {
  readonly group = input.required<CredentialGroup>();
  readonly dismissed = output<void>();

  private readonly translate = inject(TranslateService);

  protected readonly pieceOf = pieceStateOf;

  protected labelOf(item: CredentialItem): string {
    const key = kindKeyOf(item);
    return key ? (this.translate.instant(key) as string) : item.variable;
  }
}
