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
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  canReplay,
  durationText,
  failureText,
  logLabelKeyOf,
  logStateOf,
  prettyJson,
} from '../data/payment-log-view';
import type { PaymentLogDetail, PaymentLogRow } from '../data/payment-logs.models';

@Component({
  selector: 'dba-payment-log-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ModalShellComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="listBullets"
      [title]="row().operation"
      [subtitle]="
        ('plog.provider.' + row().provider | translate) +
        ' · ' +
        ('plog.stage.' + row().stage | translate)
      "
      [maxWidth]="720"
      [confirmLabel]="replayable() ? 'plog.reapply.action' : 'common.close'"
      [cancelable]="replayable()"
      cancelLabel="common.close"
      [busy]="busy()"
      (confirmed)="replayable() ? reapply.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      @if (detail(); as log) {
        <dl class="item">
          <dt>{{ 'plog.col.result' | translate }}</dt>
          <dd>
            <dba-org-state [state]="stateOf(log)" [labelKey]="labelOf(log)" variant="inline" />
          </dd>
          <dt>{{ 'plog.col.at' | translate }}</dt>
          <dd class="dba-mono">{{ when(log.at) }}</dd>
          <dt>{{ 'plog.col.duration' | translate }}</dt>
          <dd class="dba-mono">{{ duration(log.durationMs) }}</dd>
          <dt>{{ 'plog.field.direction' | translate }}</dt>
          <dd>{{ 'plog.direction.' + log.direction | translate }}</dd>
          <dt>{{ 'plog.col.organization' | translate }}</dt>
          <dd>
            @if (log.organizationId && canOpenOrg()) {
              <a class="item__link" [routerLink]="[orgsPath, log.organizationId]">{{
                log.organizationName || log.organizationId
              }}</a>
            } @else if (log.organizationId) {
              {{ log.organizationName || log.organizationId }}
            } @else {
              {{ 'plog.noOrganization' | translate }}
            }
          </dd>
          <dt>{{ 'plog.field.eventId' | translate }}</dt>
          <dd class="dba-mono">{{ log.eventId || '—' }}</dd>
          <dt>{{ 'plog.col.reference' | translate }}</dt>
          <dd class="dba-mono">{{ log.reference || '—' }}</dd>
          @if (log.planCode) {
            <dt>{{ 'plog.field.plan' | translate }}</dt>
            <dd class="dba-mono">{{ log.planCode }}</dd>
          }
          @if (log.replayOf) {
            <dt>{{ 'plog.field.replayOf' | translate }}</dt>
            <dd class="dba-mono">{{ log.replayOf }}</dd>
          }
          @if (log.outcome) {
            <dt>{{ 'plog.field.outcome' | translate }}</dt>
            <dd class="dba-mono">{{ log.outcome }}</dd>
          }
        </dl>

        @if (log.error; as error) {
          <h3 class="dba-panel item__heading">{{ 'plog.field.error' | translate }}</h3>
          <pre class="item__code dba-mono">{{ failure(log) }}</pre>
          @if (error.stack) {
            <details class="item__more">
              <summary>{{ 'plog.field.stack' | translate }}</summary>
              <pre class="item__code dba-mono">{{ error.stack }}</pre>
            </details>
          }
        }

        <h3 class="dba-panel item__heading">{{ 'plog.field.request' | translate }}</h3>
        <pre class="item__code dba-mono">{{ request() }}</pre>

        <h3 class="dba-panel item__heading">{{ 'plog.field.response' | translate }}</h3>
        <pre class="item__code dba-mono">{{ response() }}</pre>
      } @else if (failed()) {
        <p class="dba-meta">{{ 'plog.detailFailed' | translate }}</p>
      } @else {
        <db-section-loader [label]="'plog.loadingDetail' | translate" />
      }
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/detail-item.scss',
})
export class PaymentLogDetailComponent {
  readonly row = input.required<PaymentLogRow>();
  readonly detail = input<PaymentLogDetail | null>(null);
  readonly failed = input(false);
  readonly busy = input(false);
  readonly dismissed = output<void>();
  readonly reapply = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly orgsPath = sectionPath('organizations');
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));
  protected readonly replayable = computed(
    () => canReplay(this.row()) && this.auth.canManage('commercial'),
  );
  protected readonly request = computed(() => prettyJson(this.detail()?.request));
  protected readonly response = computed(() => prettyJson(this.detail()?.response));
  protected readonly stateOf = logStateOf;
  protected readonly labelOf = logLabelKeyOf;
  protected readonly failure = failureText;
  protected readonly duration = durationText;

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm:ss', this.locale);
  }
}
