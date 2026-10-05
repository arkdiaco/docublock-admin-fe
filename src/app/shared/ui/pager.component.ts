import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'db-pager',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pager" [attr.aria-label]="'common.pagination' | translate">
      <button
        type="button"
        class="pager__step"
        [attr.aria-label]="'common.prevPage' | translate"
        [disabled]="page() === 1"
        (click)="pageChange.emit(page() - 1)"
      >
        <db-icon name="chevronLeft" [size]="14" />
      </button>

      @for (n of pages(); track n) {
        <button
          type="button"
          class="pager__page"
          [class.pager__page--on]="n === page()"
          [attr.aria-current]="n === page() ? 'page' : null"
          [attr.aria-label]="pageLabel(n)"
          (click)="pageChange.emit(n)"
        >
          {{ n }}
        </button>
      }

      <button
        type="button"
        class="pager__step"
        [attr.aria-label]="'common.nextPage' | translate"
        [disabled]="page() === pageCount()"
        (click)="pageChange.emit(page() + 1)"
      >
        <db-icon name="chevronRight" [size]="14" />
      </button>
    </nav>
  `,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .pager__step {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--db-border-subtle);
      border-radius: 8px;
      background: var(--db-surface);
      color: var(--db-ink-muted);
      cursor: pointer;
    }

    .pager__step:disabled {
      color: var(--db-ink-dim);
      cursor: not-allowed;
    }

    .pager__step:not(:disabled):hover {
      background: var(--db-surface-sunken);
    }

    .pager__page {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: none;
      font-family: var(--db-font-mono);
      font-size: var(--db-text-eyebrow);
      font-weight: 600;
      color: var(--db-ink-soft);
      cursor: pointer;
    }

    .pager__page:hover {
      background: var(--db-surface-sunken);
    }

    .pager__page--on {
      background: var(--db-primary-pale-soft);
      color: var(--db-primary-ink);
    }
  `,
})
export class PagerComponent {
  private readonly translate = inject(TranslateService);

  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly pageChange = output<number>();

  readonly pages = computed(() =>
    Array.from({ length: Math.max(this.pageCount(), 1) }, (_, i) => i + 1),
  );

  protected pageLabel(n: number): string {
    return this.translate.instant('common.goPage', { page: n });
  }
}
