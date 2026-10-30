import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { SlaPolicyFormComponent } from '../components/sla-policy-form.component';
import { SupportNavComponent } from '../components/support-nav.component';
import { SupportApi } from '../data/support.api';
import { SUPPORT_ERRORS } from '../data/support-errors';
import {
  TICKET_PRIORITIES,
  type SlaPlanOption,
  type SlaPolicy,
  type SlaPolicyBody,
} from '../data/support.models';
import { durationParts, matrixOf } from '../data/ticket-view';

interface PolicyView extends SlaPolicy {
  planLabel: string;
  rows: { priority: string; first: string; resolution: string }[];
}

type Editing = { policy: SlaPolicy | null } | null;

@Component({
  selector: 'dba-sla-policies',
  imports: [
    TranslatePipe,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    SlaPolicyFormComponent,
    SupportNavComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sp">
      <dba-support-nav
        active="policies"
        [meta]="'support.pol.count' | translate: { total: policies().length }"
      >
        @if (canManage() && !loading() && !error()) {
          <div class="sp__actions">
            @if (!hasDefault()) {
              <button
                dba-button
                variant="secondary"
                [busy]="pending.key() === 'seed'"
                (click)="seedDefault()"
              >
                <db-icon name="rotate" [size]="15" />
                {{ 'support.pol.seed' | translate }}
              </button>
            }
            <button dba-button (click)="editing.set({ policy: null })">
              <db-icon name="plus" [size]="15" />
              {{ 'support.pol.create' | translate }}
            </button>
          </div>
        }
      </dba-support-nav>

      <p class="dba-body sp__lead">{{ 'support.pol.lead' | translate }}</p>

      @if (loading()) {
        <db-section-loader [label]="'support.pol.loading' | translate" />
      } @else if (error()) {
        <div class="sp__panel">
          <dba-empty-state titleKey="support.pol.errorTitle" leadKey="support.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (views().length === 0) {
        <div class="sp__panel">
          <dba-empty-state titleKey="support.pol.emptyTitle" leadKey="support.pol.emptyLead" />
        </div>
      } @else {
        @if (!hasDefault()) {
          <p class="dba-meta sp__warn">{{ 'support.pol.noDefault' | translate }}</p>
        }
        <div class="sp__grid">
          @for (policy of views(); track policy.id) {
            <article class="pc" [class.pc--off]="!policy.active">
              <header class="pc__head">
                <div class="pc__title">
                  <h2 class="dba-panel">{{ policy.name }}</h2>
                  <div class="pc__chips">
                    @if (policy.isDefault) {
                      <dba-org-state
                        state="trial"
                        labelKey="support.pol.default"
                        variant="inline"
                      />
                    }
                    <dba-org-state
                      [state]="policy.active ? 'active' : 'closed'"
                      [labelKey]="policy.active ? 'support.pol.active' : 'support.pol.inactive'"
                      variant="inline"
                    />
                  </div>
                </div>
                @if (canManage()) {
                  <div class="pc__actions">
                    <button
                      dba-button
                      variant="secondary"
                      iconOnly
                      [attr.aria-label]="'support.pol.edit' | translate"
                      [attr.title]="'support.pol.edit' | translate"
                      (click)="editing.set({ policy })"
                    >
                      <db-icon name="pencil" [size]="15" />
                    </button>
                    @if (!policy.isDefault) {
                      @if (policy.active) {
                        <button
                          dba-button
                          variant="secondary"
                          iconOnly
                          [busy]="pending.key() === 'toggle:' + policy.id"
                          [attr.aria-label]="'support.pol.deactivate' | translate"
                          [attr.title]="'support.pol.deactivate' | translate"
                          (click)="deactivate(policy)"
                        >
                          <db-icon name="archive" [size]="15" />
                        </button>
                      } @else {
                        <button
                          dba-button
                          variant="secondary"
                          iconOnly
                          [busy]="pending.key() === 'toggle:' + policy.id"
                          [attr.aria-label]="'support.pol.reactivate' | translate"
                          [attr.title]="'support.pol.reactivate' | translate"
                          (click)="reactivate(policy)"
                        >
                          <db-icon name="rotate" [size]="15" />
                        </button>
                      }
                    }
                  </div>
                }
              </header>
              <p class="dba-meta pc__plan">
                {{ 'support.pol.plan' | translate }}: <span>{{ policy.planLabel }}</span>
              </p>
              <table class="pc__table">
                <thead>
                  <tr>
                    <th scope="col">{{ 'support.f.priority' | translate }}</th>
                    <th scope="col">{{ 'support.slaTab.firstResponse' | translate }}</th>
                    <th scope="col">{{ 'support.slaTab.resolution' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of policy.rows; track row.priority) {
                    <tr>
                      <th scope="row">{{ 'support.priority.' + row.priority | translate }}</th>
                      <td>{{ row.first }}</td>
                      <td>{{ row.resolution }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </article>
          }
        </div>
        <p class="dba-meta sp__note">{{ 'support.pol.note' | translate }}</p>
      }
    </section>

    @if (editing(); as edit) {
      <dba-sla-policy-form
        [policy]="edit.policy"
        [plans]="plans()"
        [canPickPlan]="canPickPlan()"
        [busy]="pending.key() === 'save'"
        (submitted)="save(edit.policy, $event)"
        (dismissed)="editing.set(null)"
      />
    }
  `,
  styles: `
    .sp {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sp__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .sp__lead,
    .sp__warn,
    .sp__note {
      margin: 0;
    }

    .sp__lead {
      color: var(--dba-text-soft);
    }

    .sp__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sp__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--dba-grid-gap);
    }

    .pc {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .pc--off {
      background: var(--dba-surface-head);
    }

    .pc__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .pc__title {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .pc__title h2 {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .pc__chips,
    .pc__actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .pc__plan {
      margin: 0;
    }

    .pc__plan span {
      color: var(--dba-ink);
    }

    .pc__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--dba-text-cell);
    }

    .pc__table th,
    .pc__table td {
      padding: 8px 0;
      border-top: 1px solid var(--dba-border-row);
      text-align: left;
      font-weight: 400;
      color: var(--dba-ink);
    }

    .pc__table thead th {
      border-top: 0;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text-muted);
    }

    .pc__table tbody th {
      font-weight: 600;
    }

    @media (max-width: 520px) {
      .sp__grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SlaPoliciesComponent {
  private readonly api = inject(SupportApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('operations'));
  protected readonly canPickPlan = computed(() => this.auth.canRead('commercial'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly policies = signal<SlaPolicy[]>([]);
  protected readonly plans = signal<SlaPlanOption[]>([]);
  protected readonly editing = signal<Editing>(null);

  protected readonly hasDefault = computed(() =>
    this.policies().some((policy) => policy.isDefault),
  );

  protected readonly views = computed<PolicyView[]>(() => {
    const names = new Map(this.plans().map((plan) => [plan.id, plan.name]));
    return [...this.policies()]
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          Number(b.active) - Number(a.active) ||
          a.name.localeCompare(b.name, 'es'),
      )
      .map((policy) => {
        const matrix = matrixOf(policy);
        return {
          ...policy,
          planLabel: policy.planId
            ? (names.get(policy.planId) ?? policy.planId)
            : this.label('support.pol.anyPlan'),
          rows: TICKET_PRIORITIES.map((priority) => ({
            priority,
            first: this.duration(matrix[priority].firstResponseMinutes),
            resolution: this.duration(matrix[priority].resolutionMinutes),
          })),
        };
      });
  });

  constructor() {
    void this.reload();
    if (this.canPickPlan()) void this.loadPlans();
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const policies = await firstValueFrom(this.api.policies());
      if (!current()) return;
      this.policies.set(policies);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async save(policy: SlaPolicy | null, body: SlaPolicyBody): Promise<void> {
    const request = policy ? this.api.updatePolicy(policy.id, body) : this.api.createPolicy(body);
    const done = await this.run(
      'save',
      request,
      policy ? 'support.pol.saved' : 'support.pol.created',
    );
    if (done) this.editing.set(null);
  }

  protected async seedDefault(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: 'primary',
      icon: 'clock',
      title: 'support.pol.seedConfirm.title',
      message: 'support.pol.seedConfirm.message',
      confirmLabel: 'support.pol.seed',
    });
    if (!confirmed) return;
    await this.run('seed', this.api.seedDefault(), 'support.pol.seeded');
  }

  protected async deactivate(policy: SlaPolicy): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: 'danger',
      icon: 'archive',
      title: 'support.pol.deactivateConfirm.title',
      message: 'support.pol.deactivateConfirm.message',
      params: { name: policy.name },
      confirmLabel: 'support.pol.deactivate',
    });
    if (!confirmed) return;
    await this.run(
      `toggle:${policy.id}`,
      this.api.deactivatePolicy(policy.id),
      'support.pol.deactivated',
    );
  }

  protected async reactivate(policy: SlaPolicy): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: 'primary',
      icon: 'rotate',
      title: 'support.pol.reactivateConfirm.title',
      message: 'support.pol.reactivateConfirm.message',
      params: { name: policy.name },
      confirmLabel: 'support.pol.reactivate',
    });
    if (!confirmed) return;
    await this.run(
      `toggle:${policy.id}`,
      this.api.updatePolicy(policy.id, { active: true }),
      'support.pol.reactivated',
    );
  }

  private async run(key: string, request: Observable<unknown>, done: string): Promise<boolean> {
    let ok = false;
    await this.pending.run(key, async () => {
      try {
        await firstValueFrom(request);
        this.notify.success(this.label(done));
        ok = true;
        await this.reload();
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && SUPPORT_ERRORS.includes(code);
        this.notify.error(this.label(known ? `support.error.${code}` : 'support.error.generic'));
      }
    });
    return ok;
  }

  private async loadPlans(): Promise<void> {
    try {
      this.plans.set(await firstValueFrom(this.api.planOptions()));
    } catch {
      this.plans.set([]);
    }
  }

  private duration(minutes: number): string {
    return durationParts(minutes)
      .map((part) => this.label(`support.dur.${part.unit}`, { n: part.n }))
      .join(' ');
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
