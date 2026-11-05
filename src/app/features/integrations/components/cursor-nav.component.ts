import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { IconComponent } from '../../../shared/ui/icon.component';

@Component({
  selector: 'dba-cursor-nav',
  imports: [TranslatePipe, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="cursor" [attr.aria-label]="'common.pagination' | translate">
      <button dba-button variant="secondary" [disabled]="!hasPrevious() || busy()" (click)="previous.emit()">
        <db-icon name="chevronLeft" [size]="14" />
        {{ 'common.prevPage' | translate }}
      </button>
      <button dba-button variant="secondary" [disabled]="!hasNext() || busy()" (click)="next.emit()">
        {{ 'common.nextPage' | translate }}
        <db-icon name="chevronRight" [size]="14" />
      </button>
    </nav>
  `,
  styles: `
    .cursor {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class CursorNavComponent {
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);
  readonly busy = input(false);
  readonly previous = output<void>();
  readonly next = output<void>();
}
