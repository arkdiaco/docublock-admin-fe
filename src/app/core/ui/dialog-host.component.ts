import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogComponent } from '../../shared/ui/dialog.component';
import type { DialogResult } from '../../shared/ui/dialog.component';
import { DialogService } from './dialog.service';

@Component({
  selector: 'db-dialog-host',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dialogs.request(); as request) {
      @defer (prefetch on idle) {
        <db-dialog [request]="request" (closed)="close($event)" />
      }
    }
  `,
})
export class DialogHostComponent {
  protected readonly dialogs = inject(DialogService);

  protected close(result: DialogResult): void {
    this.dialogs.close(result);
  }
}
