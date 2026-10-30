import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  model,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MAX_TIERS, tierError, type TierDraft } from '../domain/price-tiers';
import { ButtonComponent } from './button.component';
import { IconComponent } from './icon.component';

let nextId = 0;

@Component({
  selector: 'dba-tier-editor',
  imports: [TranslatePipe, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="tiers" [disabled]="disabled()">
      <legend class="tiers__label">{{ label() | translate }}</legend>
      @if (tiers().length > 0) {
        <div class="tiers__head" aria-hidden="true">
          <span>{{ 'tiers.from' | translate }}</span>
          <span>{{ 'tiers.discount' | translate }}</span>
        </div>
      }
      @for (tier of tiers(); track $index; let i = $index) {
        <div class="tiers__row">
          <label class="tiers__box">
            <span class="tiers__sr">{{ 'tiers.fromRow' | translate: { n: i + 1 } }}</span>
            <input
              class="tiers__input"
              inputmode="numeric"
              maxlength="7"
              [id]="id + '-min-' + i"
              [value]="tier.minQuantity"
              (input)="set(i, 'minQuantity', $event)"
            />
            <span class="tiers__unit">{{ unit() | translate }}</span>
          </label>
          <label class="tiers__box">
            <span class="tiers__sr">{{ 'tiers.discountRow' | translate: { n: i + 1 } }}</span>
            <input
              class="tiers__input"
              inputmode="numeric"
              maxlength="3"
              [value]="tier.discountPct"
              (input)="set(i, 'discountPct', $event)"
            />
            <span class="tiers__unit">%</span>
          </label>
          <button
            dba-button
            variant="secondary"
            iconOnly
            type="button"
            [attr.aria-label]="'tiers.remove' | translate: { n: i + 1 }"
            (click)="remove(i)"
          >
            <db-icon name="trash" [size]="15" />
          </button>
        </div>
      } @empty {
        <p class="tiers__empty">{{ emptyKey() | translate }}</p>
      }
      @if (error()) {
        <p class="tiers__error">{{ error() | translate }}</p>
      }
      @if (tiers().length < max) {
        <button dba-button variant="secondary" type="button" class="tiers__add" (click)="add()">
          <db-icon name="plus" [size]="15" />
          {{ 'tiers.add' | translate }}
        </button>
      }
    </fieldset>
  `,
  styles: `
    :host {
      display: block;
    }

    .tiers {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }

    .tiers__label {
      margin-bottom: 6px;
      padding: 0;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    .tiers__head,
    .tiers__row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .tiers__head {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) var(--dba-height-control);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .tiers__box {
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--dba-height-control);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
    }

    .tiers__box:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .tiers__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .tiers__input:focus {
      outline: none;
    }

    .tiers__unit {
      flex: none;
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .tiers__sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .tiers__empty,
    .tiers__error {
      margin: 0;
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .tiers__error {
      color: var(--dba-state-suspended-fg);
    }

    .tiers__add {
      align-self: flex-start;
    }
  `,
})
export class TierEditorComponent {
  readonly tiers = model<TierDraft[]>([]);
  readonly label = input('tiers.label');
  readonly unit = input('tiers.unit');
  readonly emptyKey = input('tiers.empty');
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly id = `dba-tiers-${++nextId}`;
  protected readonly max = MAX_TIERS;
  protected readonly error = computed(() => tierError(this.tiers()));

  protected set(index: number, key: keyof TierDraft, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tiers.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  protected add(): void {
    const last = this.tiers().at(-1);
    const next =
      last && /^\d+$/.test(last.minQuantity.trim()) ? String(Number(last.minQuantity) * 2) : '100';
    this.tiers.update((rows) => [...rows, { minQuantity: next, discountPct: '0' }]);
  }

  protected remove(index: number): void {
    this.tiers.update((rows) => rows.filter((_, i) => i !== index));
  }
}
