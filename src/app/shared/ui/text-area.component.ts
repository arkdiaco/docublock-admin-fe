import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

let nextId = 0;

@Component({
  selector: 'dba-text-area',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="area" [class.area--invalid]="!!error()">
      <div class="area__top">
        @if (label()) {
          <label class="area__label" [attr.for]="id">{{ label() | translate }}</label>
        }
        @if (maxlength()) {
          <span class="area__count">{{ value().length }} / {{ maxlength() }}</span>
        }
      </div>
      <textarea
        class="area__input"
        [id]="id"
        [rows]="rows()"
        [placeholder]="placeholder() | translate"
        [attr.maxlength]="maxlength()"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="describedBy()"
        [value]="value()"
        (input)="onInput($event)"
      ></textarea>
      @if (error()) {
        <p class="area__note area__note--error" [id]="id + '-note'">{{ error() | translate }}</p>
      } @else if (hint()) {
        <p class="area__note" [id]="id + '-note'">{{ hint() | translate }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .area__top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
    }

    .area__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    .area__count {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-faint);
    }

    .area__input {
      display: block;
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-body);
      line-height: 1.45;
      color: var(--dba-ink);
      resize: vertical;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }

    .area__input:focus {
      outline: none;
      border-color: var(--dba-violet-500);
      box-shadow:
        inset 0 0 0 0.5px var(--dba-violet-500),
        0 0 0 3px var(--dba-focus-halo);
    }

    .area__input::placeholder {
      color: var(--dba-text-faint);
    }

    .area--invalid .area__input {
      border-color: var(--dba-state-suspended-dot);
    }

    .area__note {
      margin: 6px 0 0;
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .area__note--error {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class TextAreaComponent {
  readonly value = model('');
  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly rows = input(3);
  readonly maxlength = input<number | null>(null);

  protected readonly id = `dba-area-${++nextId}`;
  protected readonly describedBy = computed(() =>
    this.error() || this.hint() ? `${this.id}-note` : null,
  );

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }
}
