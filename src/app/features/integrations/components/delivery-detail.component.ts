import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { deliveryStateOf, prettyPayload } from '../data/delivery-view';
import type { DeliveryDetail, DeliveryRow } from '../data/integrations.models';

@Component({
  selector: 'dba-delivery-detail',
  imports: [TranslatePipe, RouterLink, ModalShellComponent, OrgStateComponent, SectionLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="row().event"
      [subtitle]="row().organizationName || ('dlv.unknownOrg' | translate)"
      [maxWidth]="640"
      [confirmLabel]="canReplay() ? 'dlv.replay.action' : 'common.close'"
      [confirmDisabled]="canReplay() && !detail()"
      [cancelable]="canReplay()"
      cancelLabel="common.close"
      (confirmed)="canReplay() ? replay.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      @if (detail(); as delivery) {
        <dl class="item">
          <dt>{{ 'dlv.col.status' | translate }}</dt>
          <dd>
            <dba-org-state [state]="stateOf(delivery)" [labelKey]="'dlv.status.' + delivery.status" variant="inline" />
          </dd>
          <dt>{{ 'dlv.col.organization' | translate }}</dt>
          <dd>
            @if (delivery.organizationName) {
              <a class="item__link" [routerLink]="[orgsPath, delivery.organizationId]">{{ delivery.organizationName }}</a>
            } @else {
              {{ 'dlv.unknownOrg' | translate }}
            }
          </dd>
          <dt>{{ 'dlv.contract' | translate }}</dt>
          <dd>{{ 'dlv.contractOf.' + delivery.contract | translate }}</dd>
          <dt>{{ 'dlv.destination' | translate }}</dt>
          <dd class="dba-mono">{{ delivery.destinationUrl || ('dlv.noDestination' | translate) }}</dd>
          <dt>{{ 'dlv.col.attempts' | translate }}</dt>
          <dd class="dba-mono">{{ delivery.attempts }}</dd>
          <dt>{{ 'dlv.lastCode' | translate }}</dt>
          <dd class="dba-mono">{{ delivery.lastStatusCode ?? '—' }}</dd>
          <dt>{{ 'dlv.document' | translate }}</dt>
          <dd class="dba-mono">{{ delivery.documentId || '—' }}</dd>
          <dt>{{ 'dlv.col.created' | translate }}</dt>
          <dd class="dba-mono">{{ when(delivery.createdAt) }}</dd>
          @if (delivery.deliveredAt) {
            <dt>{{ 'dlv.deliveredAt' | translate }}</dt>
            <dd class="dba-mono">{{ when(delivery.deliveredAt) }}</dd>
          }
          @if (delivery.nextAttemptAt) {
            <dt>{{ 'dlv.nextAttempt' | translate }}</dt>
            <dd class="dba-mono">{{ when(delivery.nextAttemptAt) }}</dd>
          }
        </dl>

        @if (!delivery.destinationUrl) {
          <p class="dba-meta item__note">{{ 'dlv.noDestinationNote' | translate }}</p>
        }

        @if (delivery.test) {
          <p class="dba-meta item__note">{{ 'dlv.testNote' | translate }}</p>
        }

        @if (delivery.lastError) {
          <h3 class="dba-panel item__heading">{{ 'dlv.lastError' | translate }}</h3>
          <pre class="item__code dba-mono">{{ delivery.lastError }}</pre>
        }

        <details class="item__more">
          <summary>{{ 'dlv.payload' | translate }}</summary>
          <pre class="item__code dba-mono">{{ payload() }}</pre>
        </details>
      } @else if (failed()) {
        <p class="dba-meta">{{ 'dlv.detailFailed' | translate }}</p>
      } @else {
        <db-section-loader [label]="'dlv.loadingDetail' | translate" />
      }
    </db-modal-shell>
  `,
  styleUrl: './integration-item.scss',
})
export class DeliveryDetailComponent {
  readonly row = input.required<DeliveryRow>();
  readonly detail = input<DeliveryDetail | null>(null);
  readonly failed = input(false);
  readonly replay = output<void>();
  readonly dismissed = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly orgsPath = sectionPath('organizations');
  protected readonly canReplay = computed(() => {
    const detail = this.detail();
    return this.auth.canManage('operations') && (!detail || !!detail.destinationUrl);
  });
  protected readonly payload = computed(() => prettyPayload(this.detail()?.payload ?? {}));

  protected stateOf(delivery: DeliveryDetail): ReturnType<typeof deliveryStateOf> {
    return deliveryStateOf(delivery.status);
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm:ss', this.locale);
  }
}
