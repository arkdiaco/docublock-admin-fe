import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import {
  draftOf,
  isRecommended,
  parseSettingDraft,
  sameSettingValue,
  valueLabelOf,
} from '../data/settings-view';
import type { SettingItem, SettingValue } from '../data/settings.models';

export interface SettingEditResult {
  value: SettingValue;
  reason: string;
}

@Component({
  selector: 'dba-setting-edit',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="settings"
      [title]="'cfg.item.' + setting().key + '.label' | translate"
      [subtitle]="'cfg.item.' + setting().key + '.audience' | translate"
      confirmLabel="cfg.edit.confirm"
      [confirmDisabled]="!canSubmit()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field
          [label]="fieldLabel()"
          [mono]="true"
          inputmode="numeric"
          [hint]="hint()"
          [error]="invalid() ? errorText() : ''"
          [(value)]="draft"
        />
        @if (outOfRecommended()) {
          <p class="notice" role="note">
            {{ 'cfg.edit.outOfRecommended' | translate: setting().recommended }}
          </p>
        }
        <dba-field
          label="cfg.reasonLabel"
          placeholder="cfg.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
        <p class="sum">{{ 'cfg.edit.delay' | translate }}</p>
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class SettingEditComponent {
  readonly setting = input.required<SettingItem>();
  readonly busy = input(false);
  readonly submitted = output<SettingEditResult>();
  readonly dismissed = output<void>();

  private readonly translate = inject(TranslateService);

  protected readonly draft = linkedSignal(() => draftOf(this.setting().value));
  protected readonly reason = signal('');

  private readonly parsed = computed(() => parseSettingDraft(this.setting(), this.draft()));

  protected readonly invalid = computed(() => this.parsed() === null);
  protected readonly outOfRecommended = computed(() => {
    const value = this.parsed();
    return value !== null && !isRecommended(this.setting(), value);
  });
  protected readonly fieldLabel = computed(() => `cfg.editLabel.${this.setting().unit}`);
  protected readonly hint = computed(() => {
    const { unit, defaultValue, kind } = this.setting();
    const { key, params } = valueLabelOf(unit, defaultValue);
    const label = this.translate.instant(key, params) as string;
    const list =
      kind === 'integer_list' ? (this.translate.instant('cfg.edit.listHint') as string) : '';
    return `${this.translate.instant('cfg.edit.defaultHint', { value: label }) as string}${list}`;
  });
  protected readonly errorText = computed(() => {
    const { technical, maxItems, kind } = this.setting();
    const params = { ...technical, maxItems };
    const key = kind === 'integer_list' ? 'cfg.edit.invalidList' : 'cfg.edit.invalid';
    return this.translate.instant(key, params) as string;
  });
  protected readonly canSubmit = computed(() => {
    const value = this.parsed();
    return (
      value !== null && !sameSettingValue(value, this.setting().value) && !!this.reason().trim()
    );
  });

  protected submit(): void {
    const value = this.parsed();
    if (value === null || !this.canSubmit() || this.busy()) return;
    this.submitted.emit({ value, reason: this.reason().trim() });
  }
}
