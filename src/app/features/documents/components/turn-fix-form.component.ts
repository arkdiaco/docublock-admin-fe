import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { PlatformDocumentDetail, TurnFix } from '../data/documents.models';
import { reasonReady } from '../data/reason';
import { pendingNamesAt, type NoticeRequest } from '../data/turn-changes';
import { TurnNoticeFieldComponent } from './turn-notice-field.component';

@Component({
  selector: 'dba-turn-fix-form',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent, TurnNoticeFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="listNumbers"
      [title]="'docs.turnFix.title' | translate"
      [subtitle]="document().name"
      confirmLabel="docs.turnFix.confirm"
      [confirmDisabled]="!valid() || waiting()"
      [busy]="busy()"
      [note]="waiting() && !busy() ? 'docs.act.waiting' : ''"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="form__note--top">
          {{ 'docs.turnFix.lead' | translate: { from: fix().from, to: fix().to } }}
        </p>
        <div class="form__summary">
          <span>{{ 'docs.turnFix.pending' | translate: { to: fix().to, names: pending() } }}</span>
        </div>
        <dba-turn-notice-field
          [document]="document()"
          [invitable]="fix().invitable"
          [(notify)]="notify"
        />
        <dba-field
          label="docs.act.reasonLabel"
          placeholder="docs.act.reasonPlaceholder"
          hint="docs.act.reasonMin"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss'],
})
export class TurnFixFormComponent {
  readonly document = input.required<PlatformDocumentDetail>();
  readonly fix = input.required<TurnFix>();
  readonly busy = input(false);
  readonly waiting = input(false);
  readonly submitted = output<NoticeRequest>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  protected readonly notify = signal(false);

  protected readonly pending = computed(() => pendingNamesAt(this.document(), this.fix().to));
  protected readonly valid = computed(() => reasonReady(this.reason()));

  protected submit(): void {
    const reason = this.reason().trim();
    if (this.valid() && !this.busy() && !this.waiting())
      this.submitted.emit({ reason, notify: this.notify() && this.fix().invitable.length > 0 });
  }
}
