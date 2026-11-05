import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { canRevoke, keyStateOf } from '../data/key-view';
import type { KeyRow } from '../data/integrations.models';

@Component({
  selector: 'dba-key-detail',
  imports: [TranslatePipe, RouterLink, ModalShellComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="shield"
      [title]="key().name"
      [subtitle]="key().organizationName || ('dlv.unknownOrg' | translate)"
      [maxWidth]="560"
      [confirmLabel]="revocable() ? 'ikey.revoke.action' : 'common.close'"
      [cancelable]="revocable()"
      cancelLabel="common.close"
      (confirmed)="revocable() ? revoke.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <dl class="item">
        <dt>{{ 'ikey.col.state' | translate }}</dt>
        <dd><dba-org-state [state]="state()" [labelKey]="'integ.keyState.' + key().state" variant="inline" /></dd>
        <dt>{{ 'ikey.col.organization' | translate }}</dt>
        <dd>
          @if (key().organizationName) {
            <a class="item__link" [routerLink]="[orgsPath, key().organizationId]">{{ key().organizationName }}</a>
          } @else {
            {{ 'dlv.unknownOrg' | translate }}
          }
        </dd>
        <dt>{{ 'ikey.prefix' | translate }}</dt>
        <dd class="dba-mono">{{ key().prefix }}</dd>
        <dt>{{ 'ikey.scopes' | translate }}</dt>
        <dd class="dba-mono">{{ key().scopes.join(', ') || '—' }}</dd>
        <dt>{{ 'ikey.col.used' | translate }}</dt>
        <dd class="dba-mono">{{ when(key().lastUsedAt) }}</dd>
        <dt>{{ 'ikey.col.expires' | translate }}</dt>
        <dd class="dba-mono">{{ when(key().expiresAt) }}</dd>
        <dt>{{ 'ikey.created' | translate }}</dt>
        <dd class="dba-mono">{{ when(key().createdAt) }}</dd>
        @if (key().revokedAt) {
          <dt>{{ 'ikey.revokedAt' | translate }}</dt>
          <dd class="dba-mono">{{ when(key().revokedAt) }}</dd>
        }
      </dl>
    </db-modal-shell>
  `,
  styleUrl: './integration-item.scss',
})
export class KeyDetailComponent {
  readonly key = input.required<KeyRow>();
  readonly revoke = output<void>();
  readonly dismissed = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly orgsPath = sectionPath('organizations');
  protected readonly state = computed(() => keyStateOf(this.key().state));
  protected readonly revocable = computed(() => this.auth.canManage('operations') && canRevoke(this.key()));

  protected when(value: string | null): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }
}
