import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { TICKET_PRIORITIES, type SlaRule, type TicketPriority } from '../data/support.models';
import { durationParts, isValidMinutes } from '../data/ticket-view';

export type RuleKey = keyof SlaRule;
export type MatrixDraft = Record<TicketPriority, Record<RuleKey, string>>;

export interface MatrixCellChange {
  priority: TicketPriority;
  key: RuleKey;
  value: string;
}

const MINUTES = /^\d{1,6}$/;

export const minutesOf = (text: string): number =>
  MINUTES.test(text.trim()) ? Number(text.trim()) : Number.NaN;

@Component({
  selector: 'dba-sla-matrix-fields',
  imports: [TranslatePipe, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx" role="group" [attr.aria-label]="'support.pol.form.matrix' | translate">
      @for (priority of priorities; track priority) {
        <span class="mx__row">{{ 'support.priority.' + priority | translate }}</span>
        @for (key of ruleKeys; track key) {
          <dba-field
            [label]="'support.pol.form.cell.' + key"
            inputmode="numeric"
            mono
            [maxlength]="6"
            [hint]="hintOf(priority, key)"
            [error]="errorOf(priority, key)"
            [value]="draft()[priority][key]"
            (valueChange)="changed.emit({ priority, key, value: $event })"
          />
        }
      }
    </div>
  `,
  styles: `
    .mx {
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }

    .mx__row {
      padding-top: 30px;
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
    }

    @media (max-width: 520px) {
      .mx {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .mx__row {
        grid-column: 1 / -1;
        padding-top: 6px;
      }
    }
  `,
})
export class SlaMatrixFieldsComponent {
  private readonly translate = inject(TranslateService);

  readonly draft = input.required<MatrixDraft>();
  readonly changed = output<MatrixCellChange>();

  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly ruleKeys: readonly RuleKey[] = ['firstResponseMinutes', 'resolutionMinutes'];

  protected errorOf(priority: TicketPriority, key: RuleKey): string {
    const text = this.draft()[priority][key];
    if (!text.trim()) return 'support.pol.form.required';
    const minutes = minutesOf(text);
    if (!isValidMinutes(minutes)) return 'support.pol.form.rangeError';
    const first = minutesOf(this.draft()[priority].firstResponseMinutes);
    return key === 'resolutionMinutes' && isValidMinutes(first) && minutes < first
      ? 'support.pol.form.orderError'
      : '';
  }

  protected hintOf(priority: TicketPriority, key: RuleKey): string {
    const minutes = minutesOf(this.draft()[priority][key]);
    if (!isValidMinutes(minutes)) return 'support.pol.form.minutes';
    return durationParts(minutes)
      .map((part) => this.translate.instant(`support.dur.${part.unit}`, { n: part.n }) as string)
      .join(' ');
  }
}
