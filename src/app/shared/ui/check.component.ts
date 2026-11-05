import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'dba-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="checkbox"
      class="check"
      [attr.aria-label]="label()"
      [checked]="checked()"
      [disabled]="disabled()"
      (change)="toggled.emit()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    .check {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--dba-violet-500);
      cursor: pointer;
    }

    .check:disabled {
      cursor: not-allowed;
    }
  `,
})
export class CheckComponent {
  readonly checked = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly label = input('');
  readonly toggled = output<void>();
}
