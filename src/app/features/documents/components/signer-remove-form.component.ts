import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { PlatformDocumentDetail, PlatformSigner } from '../data/documents.models';
import { reasonReady } from '../data/reason';
import { removalSummaryOf, removalWarningsOf, type NoticeRequest } from '../data/turn-changes';
import { TurnNoticeFieldComponent } from './turn-notice-field.component';

@Component({
  selector: 'dba-signer-remove-form',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent, TurnNoticeFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="trash"
      [title]="'docs.remove.title' | translate"
      [subtitle]="signer().name"
      confirmLabel="docs.remove.confirm"
      [confirmDisabled]="!valid() || waiting()"
      [busy]="busy()"
      [note]="waiting() && !busy() ? 'docs.act.waiting' : ''"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="form__note--top">{{ 'docs.remove.lead' | translate: { name: signer().name } }}</p>
        <div class="form__summary">
          @for (line of summary(); track line.key) {
            <span>{{ line.key | translate: line.params }}</span>
          }
        </div>
        @for (warning of warnings(); track warning.key) {
          <p class="notice" role="note">{{ warning.key | translate: warning.params }}</p>
        }
        <dba-turn-notice-field
          [document]="document()"
          [invitable]="invitable()"
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
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class SignerRemoveFormComponent {
  readonly document = input.required<PlatformDocumentDetail>();
  readonly signer = input.required<PlatformSigner>();
  readonly busy = input(false);
  readonly waiting = input(false);
  readonly submitted = output<NoticeRequest>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  protected readonly notify = signal(false);

  protected readonly summary = computed(() => removalSummaryOf(this.document(), this.signer()));
  protected readonly warnings = computed(() => removalWarningsOf(this.document(), this.signer()));
  protected readonly invitable = computed(() => this.signer().removal?.invitable ?? []);
  protected readonly valid = computed(() => !!this.signer().removal && reasonReady(this.reason()));

  protected submit(): void {
    const reason = this.reason().trim();
    if (this.valid() && !this.busy() && !this.waiting())
      this.submitted.emit({ reason, notify: this.notify() && this.invitable().length > 0 });
  }
}
