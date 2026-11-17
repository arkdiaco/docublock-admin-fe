import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface ChoiceOption {
  value: string;
  labelKey: string;
  leadKey?: string;
}

let nextGroup = 0;

@Component({
  selector: 'dba-choice-list',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="choices" role="radiogroup" [attr.aria-label]="label() || null">
      @for (option of options(); track option.value) {
        <label class="choice" [class.choice--on]="value() === option.value">
          <input
            class="choice__radio"
            type="radio"
            [name]="group"
            [value]="option.value"
            [checked]="value() === option.value"
            [disabled]="disabled()"
            (change)="picked.emit(option.value)"
          />
          <span class="choice__copy">
            <span class="choice__label">{{ option.labelKey | translate }}</span>
            @if (option.leadKey) {
              <span class="choice__lead">{{ option.leadKey | translate }}</span>
            }
          </span>
        </label>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .choices {
      display: flex;
      flex-direction: column;
    }

    .choice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 4px;
      border-top: 1px solid var(--dba-border-row);
      cursor: pointer;
    }

    .choice:last-child {
      border-bottom: 1px solid var(--dba-border-row);
    }

    .choice:hover {
      background: var(--dba-surface-hover);
    }

    .choice__radio {
      flex: none;
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      accent-color: var(--dba-violet-500);
      cursor: pointer;
    }

    .choice__radio:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .choice__radio:disabled {
      cursor: not-allowed;
    }

    .choice__copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .choice__label {
      font-size: var(--dba-text-body);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .choice__lead {
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }
  `,
})
export class ChoiceListComponent {
  readonly options = input.required<readonly ChoiceOption[]>();
  readonly value = input<string | null>(null);
  readonly label = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly picked = output<string>();

  protected readonly group = `dba-choice-${++nextGroup}`;
}
