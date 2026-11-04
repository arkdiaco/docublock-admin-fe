import { ChangeDetectionStrategy, Component, computed, input, output, signal, type OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import type { ConsentDraft, ConsentPolicy, PolicyLocale } from '../data/catalogs.models';

const MIN_TEXT = 20;
const CODE = /^[a-z][a-z0-9-]{1,39}$/;

@Component({
  selector: 'dba-consent-publish-form',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent, TextAreaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="policy() ? 'pencil' : 'plus'"
      [title]="(policy() ? 'cat.consent.newVersionTitle' : 'cat.consent.createTitle') | translate"
      [subtitle]="policy()?.code ?? ''"
      confirmLabel="cat.consent.publish"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="680"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-meta">{{ 'cat.consent.publishNotice' | translate }}</p>
        @if (!policy()) {
          <dba-field
            label="cat.consent.code"
            hint="cat.consent.codeHint"
            [maxlength]="40"
            mono
            [(value)]="code"
          />
        }
        <dba-field label="cat.consent.titleLabel" [maxlength]="200" [(value)]="title" />
        <dba-text-area
          label="cat.consent.text"
          hint="cat.consent.textHint"
          [rows]="8"
          [maxlength]="100000"
          [(value)]="text"
        />
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class ConsentPublishFormComponent implements OnInit {
  readonly policy = input<ConsentPolicy | null>(null);
  readonly locale = input.required<PolicyLocale>();
  readonly busy = input(false);
  readonly submitted = output<{ draft: ConsentDraft; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly code = signal('');
  protected readonly title = signal('');
  protected readonly text = signal('');
  protected readonly reason = signal('');
  protected readonly canSave = computed(
    () =>
      CODE.test(this.code().trim()) &&
      !!this.title().trim() &&
      this.text().trim().length >= MIN_TEXT &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    const policy = this.policy();
    this.code.set(policy?.code ?? '');
    this.title.set(policy?.title ?? '');
    this.text.set(policy?.text ?? '');
  }

  protected submit(): void {
    if (!this.canSave()) return;
    this.submitted.emit({
      reason: this.reason().trim(),
      draft: {
        code: this.code().trim(),
        title: this.title().trim(),
        text: this.text().trim(),
        locale: this.locale(),
      },
    });
  }
}
