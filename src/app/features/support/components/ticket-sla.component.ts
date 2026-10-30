import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import type { TicketSummary } from '../data/support.models';
import {
  GOAL_FAMILY,
  durationParts,
  isDefaultPolicyName,
  slaGoalsOf,
  type SlaGoal,
} from '../data/ticket-view';

interface GoalView extends SlaGoal {
  target: string;
  due: string;
  done: string;
}

@Component({
  selector: 'dba-ticket-sla',
  imports: [TranslatePipe, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sla">
      <header class="sla__head">
        <h2 class="dba-panel">{{ 'support.slaTab.policy' | translate }}</h2>
        <span class="sla__policy">{{ policy() }}</span>
      </header>
      <dl class="sla__goals">
        @for (goal of goals(); track goal.key) {
          <div class="goal">
            <dt class="goal__name">
              {{ 'support.slaTab.' + goal.key | translate }}
              <dba-org-state
                [state]="family[goal.state]"
                [labelKey]="'support.goal.' + goal.state"
                variant="inline"
              />
            </dt>
            <dd class="goal__grid">
              <span class="goal__label">{{ 'support.slaTab.target' | translate }}</span>
              <span class="goal__value">{{ goal.target }}</span>
              <span class="goal__label">{{ 'support.slaTab.due' | translate }}</span>
              <span class="goal__value dba-mono">{{ goal.due }}</span>
              <span class="goal__label">{{ 'support.slaTab.done.' + goal.key | translate }}</span>
              <span class="goal__value dba-mono">{{ goal.done }}</span>
            </dd>
          </div>
        }
      </dl>
      <p class="dba-meta sla__note">{{ 'support.slaTab.note' | translate }}</p>
    </section>
  `,
  styles: `
    .sla {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sla__head {
      display: flex;
      align-items: baseline;
      gap: 12px;
      flex-wrap: wrap;
    }

    .sla__head h2 {
      margin: 0;
    }

    .sla__policy {
      font-size: var(--dba-text-cell);
      color: var(--dba-text-soft);
    }

    .sla__goals {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--dba-grid-gap);
      margin: 0;
    }

    .goal {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--dba-border-row);
    }

    .goal__name {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .goal__grid {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
    }

    .goal__label {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .goal__value {
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .sla__note {
      margin: 0;
    }

    @media (max-width: 760px) {
      .sla__goals {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TicketSlaComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly ticket = input.required<Pick<TicketSummary, 'status' | 'sla'>>();

  protected readonly family = GOAL_FAMILY;

  protected readonly policy = computed(() => {
    const sla = this.ticket().sla;
    return isDefaultPolicyName(sla)
      ? (this.translate.instant('support.slaTab.defaultPolicy') as string)
      : sla.policyName;
  });

  protected readonly goals = computed<GoalView[]>(() =>
    slaGoalsOf(this.ticket(), new Date()).map((goal) => ({
      ...goal,
      target: this.duration(goal.minutes),
      due: this.stamp(goal.dueAt),
      done: goal.doneAt ? this.stamp(goal.doneAt) : '—',
    })),
  );

  private stamp(value: string): string {
    return formatDate(value, 'd/MM/y HH:mm', this.locale);
  }

  private duration(minutes: number): string {
    const parts = durationParts(minutes);
    return parts.length
      ? parts
          .map(
            (part) => this.translate.instant(`support.dur.${part.unit}`, { n: part.n }) as string,
          )
          .join(' ')
      : '—';
  }
}
