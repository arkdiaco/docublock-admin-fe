import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { numberOf } from '../data/billing-view';

export interface TaxDraft {
  type: string;
  amount: string;
}

export const taxDraftValid = (draft: TaxDraft): boolean => {
  const amount = numberOf(draft.amount);
  return draft.type.trim().length > 0 && Number.isFinite(amount) && amount >= 0;
};

const untouched = (draft: TaxDraft): boolean =>
  draft.type.trim().length === 0 && draft.amount.trim().length === 0;

@Component({
  selector: 'dba-tax-lines',
  imports: [TranslatePipe, ButtonComponent, FieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (line of lines(); track $index; let index = $index) {
      <div class="tax">
        <dba-field
          class="tax__type"
          label="billing.taxes.type"
          placeholder="billing.taxes.typePlaceholder"
          [maxlength]="40"
          [value]="line.type"
          (valueChange)="set(index, { type: $event, amount: line.amount })"
        />
        <dba-field
          class="tax__amount"
          label="billing.taxes.amount"
          inputmode="decimal"
          [error]="problem(line) ? 'billing.taxes.invalid' : ''"
          [value]="line.amount"
          (valueChange)="set(index, { type: line.type, amount: $event })"
        />
        <button
          dba-button
          type="button"
          variant="secondary"
          class="tax__remove"
          [attr.aria-label]="'billing.taxes.remove' | translate"
          (click)="remove(index)"
        >
          <db-icon name="trash" [size]="15" />
        </button>
      </div>
    }
    <div>
      <button dba-button type="button" variant="secondary" (click)="add()">
        <db-icon name="plus" [size]="15" />
        {{ 'billing.taxes.add' | translate }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tax {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
    }

    .tax__remove {
      margin-top: 24px;
    }

    @media (max-width: 520px) {
      .tax {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .tax__type {
        grid-column: 1 / -1;
      }

      .tax__remove {
        margin-top: 24px;
      }
    }
  `,
})
export class TaxLinesComponent {
  readonly lines = input.required<readonly TaxDraft[]>();
  readonly linesChange = output<TaxDraft[]>();

  protected problem(line: TaxDraft): boolean {
    return !untouched(line) && !taxDraftValid(line);
  }

  protected set(index: number, next: TaxDraft): void {
    this.linesChange.emit(this.lines().map((line, at) => (at === index ? next : line)));
  }

  protected add(): void {
    this.linesChange.emit([...this.lines(), { type: '', amount: '' }]);
  }

  protected remove(index: number): void {
    this.linesChange.emit(this.lines().filter((_, at) => at !== index));
  }
}
