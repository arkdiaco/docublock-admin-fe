import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import type { EndpointRow } from '../data/integrations.models';

@Component({
  selector: 'dba-endpoint-detail',
  imports: [TranslatePipe, RouterLink, ModalShellComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="endpoint().description || endpoint().url"
      [subtitle]="endpoint().organizationName || ('dlv.unknownOrg' | translate)"
      [maxWidth]="560"
      [confirmLabel]="canManage() ? (endpoint().enabled ? 'iep.disable.action' : 'iep.enable.action') : 'common.close'"
      [cancelable]="canManage()"
      cancelLabel="common.close"
      (confirmed)="canManage() ? switched.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <dl class="item">
        <dt>{{ 'iep.col.state' | translate }}</dt>
        <dd>
          <dba-org-state
            [state]="endpoint().enabled ? 'active' : 'suspended'"
            [labelKey]="endpoint().enabled ? 'iep.state.enabled' : 'iep.state.disabled'"
            variant="inline"
          />
        </dd>
        <dt>{{ 'iep.col.organization' | translate }}</dt>
        <dd>
          @if (endpoint().organizationName) {
            <a class="item__link" [routerLink]="[orgsPath, endpoint().organizationId]">{{ endpoint().organizationName }}</a>
          } @else {
            {{ 'dlv.unknownOrg' | translate }}
          }
        </dd>
        <dt>{{ 'iep.col.url' | translate }}</dt>
        <dd class="dba-mono">{{ endpoint().url }}</dd>
        <dt>{{ 'iep.events' | translate }}</dt>
        <dd class="dba-mono">{{ endpoint().events.join(', ') || ('iep.allEvents' | translate) }}</dd>
        <dt>{{ 'iep.col.failures' | translate }}</dt>
        <dd class="dba-mono">{{ endpoint().recentFailures }}</dd>
        <dt>{{ 'iep.deliveries' | translate }}</dt>
        <dd>
          <a class="item__link" [routerLink]="[deliveriesPath]" [queryParams]="{ organizacion: endpoint().organizationId }">{{
            'iep.seeDeliveries' | translate
          }}</a>
        </dd>
        <dt>{{ 'iep.lastFailure' | translate }}</dt>
        <dd class="dba-mono">{{ when(endpoint().lastFailureAt) }}</dd>
        <dt>{{ 'iep.created' | translate }}</dt>
        <dd class="dba-mono">{{ when(endpoint().createdAt) }}</dd>
      </dl>

      @if (endpoint().lastError) {
        <h3 class="dba-panel item__heading">{{ 'dlv.lastError' | translate }}</h3>
        <pre class="item__code dba-mono">{{ endpoint().lastError }}</pre>
      }
    </db-modal-shell>
  `,
  styleUrl: './integration-item.scss',
})
export class EndpointDetailComponent {
  readonly endpoint = input.required<EndpointRow>();
  readonly switched = output<void>();
  readonly dismissed = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly orgsPath = sectionPath('organizations');
  protected readonly deliveriesPath = sectionPath('integrations');
  protected readonly canManage = computed(() => this.auth.canManage('operations'));

  protected when(value: string | null): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }
}
