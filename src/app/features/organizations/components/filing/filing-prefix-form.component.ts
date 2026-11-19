import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import {
  filingExample,
  filingYearOf,
  isFilingPrefix,
  normalizeFilingPrefix,
} from '../../data/org-filing';
import type { FilingPrefixBody } from '../../data/org-filing.models';

@Component({
  selector: 'dba-filing-prefix-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="docCheck"
      [title]="'orgFiling.form.title' | translate"
      [subtitle]="
        current()
          ? ('orgFiling.form.current' | translate: { prefix: current() })
          : ('orgFiling.noPrefix' | translate)
      "
      confirmLabel="orgFiling.form.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="460"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="notice">{{ 'orgFiling.form.warning' | translate }}</p>
        <dba-field
          label="orgFiling.form.prefix"
          placeholder="orgFiling.form.prefixPlaceholder"
          mono
          [maxlength]="8"
          [hint]="preview()"
          [error]="prefixError()"
          [(value)]="prefix"
        />
        <dba-field
          label="orgFiling.form.reason"
          placeholder="orgFiling.form.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../../shared/ui/modal-form.scss', '../../../../shared/ui/confirm-notice.scss'],
})
export class FilingPrefixFormComponent {
  private readonly translate = inject(TranslateService);

  readonly current = input<string | null>(null);
  readonly busy = input(false);
  readonly submitted = output<FilingPrefixBody>();
  readonly dismissed = output<void>();

  protected readonly prefix = signal('');
  protected readonly reason = signal('');

  protected readonly normalized = computed(() => normalizeFilingPrefix(this.prefix()));
  protected readonly prefixError = computed(() => {
    if (!this.prefix().trim()) return '';
    if (!isFilingPrefix(this.normalized())) return 'orgFiling.form.invalid';
    return this.normalized() === this.current() ? 'orgFiling.form.same' : '';
  });
  protected readonly preview = computed(() =>
    this.prefix().trim() && !this.prefixError()
      ? (this.translate.instant('orgFiling.form.preview', {
          example: filingExample(this.normalized(), filingYearOf(new Date())),
        }) as string)
      : '',
  );
  protected readonly valid = computed(
    () => !!this.prefix().trim() && !this.prefixError() && !!this.reason().trim(),
  );

  protected submit(): void {
    if (!this.valid()) return;
    this.submitted.emit({ prefix: this.normalized(), reason: this.reason().trim() });
  }
}
